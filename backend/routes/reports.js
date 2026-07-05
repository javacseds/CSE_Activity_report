const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Reports } = require('../dbHelper');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads folder exists for local storage fallback
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// @route   GET api/reports
// @desc    Get all reports for user (or all if admin)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let reports;
    if (req.user.role === 'admin') {
      reports = await Reports.find({ isTemplate: false });
    } else {
      reports = await Reports.find({
        $or: [
          { userId: req.user.id },
          { userIdFallback: req.user.id }
        ],
        isTemplate: false
      });
    }
    res.json(reports);
  } catch (err) {
    console.error('Fetch reports error:', err);
    res.status(500).send('Server error');
  }
});

// @route   GET api/reports/:id
// @desc    Get report by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const report = await Reports.findById(req.id || req.params.id);
    if (!report) {
      return res.status(404).json({ msg: 'Report not found' });
    }
    res.json(report);
  } catch (err) {
    console.error('Fetch report detail error:', err);
    res.status(500).send('Server error');
  }
});

// @route   POST api/reports
// @desc    Create a new report/draft
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const newReportData = {
      ...req.body,
      userId: req.user.id,
      userIdFallback: req.user.id,
      isTemplate: false,
      version: 1,
      history: []
    };

    const report = await Reports.save(newReportData);
    res.json(report);
  } catch (err) {
    console.error('Create report error:', err);
    res.status(500).send('Server error');
  }
});

// @route   PUT api/reports/:id
// @desc    Update report (with autosave & version tracking)
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const report = await Reports.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ msg: 'Report not found' });
    }

    const { makeSnapshot, snapshotMessage } = req.body;
    let updateData = { ...req.body };
    delete updateData.makeSnapshot;
    delete updateData.snapshotMessage;

    // Check ownership (admins can edit anything, users edit their own)
    const reportUserId = report.userId ? report.userId.toString() : report.userIdFallback;
    if (req.user.role !== 'admin' && reportUserId !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized to edit this report' });
    }

    // Versioning / History tracking
    let currentVersion = report.version || 1;
    let history = [...(report.history || [])];

    if (makeSnapshot) {
      currentVersion += 1;
      history.push({
        version: report.version || 1,
        updatedAt: new Date(),
        updatedBy: req.user.id,
        title: snapshotMessage || `Version ${report.version || 1} snapshot`,
        fields: JSON.parse(JSON.stringify(report.fields || []))
      });
      updateData.version = currentVersion;
      updateData.history = history;
    }

    // Keep IDs correct
    updateData._id = req.params.id;
    updateData.id = req.params.id;

    const updatedReport = await Reports.save(updateData);
    res.json(updatedReport);
  } catch (err) {
    console.error('Update report error:', err);
    res.status(500).send('Server error');
  }
});

// @route   POST api/reports/:id/duplicate
// @desc    Duplicate a report
// @access  Private
router.post('/:id/duplicate', auth, async (req, res) => {
  try {
    const report = await Reports.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ msg: 'Report not found' });
    }

    const reportObj = report.toObject ? report.toObject() : report;
    const { _id, id, createdAt, updatedAt, version, history, ...rest } = reportObj;

    const duplicatedData = {
      ...rest,
      title: `${report.title} (Copy)`,
      userId: req.user.id,
      userIdFallback: req.user.id,
      version: 1,
      history: []
    };

    const newReport = await Reports.save(duplicatedData);
    res.json(newReport);
  } catch (err) {
    console.error('Duplicate report error:', err);
    res.status(500).send('Server error');
  }
});

// @route   DELETE api/reports/:id
// @desc    Delete report
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const report = await Reports.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ msg: 'Report not found' });
    }

    // Check ownership
    const reportUserId = report.userId ? report.userId.toString() : report.userIdFallback;
    if (req.user.role !== 'admin' && reportUserId !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized to delete this report' });
    }

    await Reports.delete(req.params.id);
    res.json({ msg: 'Report removed' });
  } catch (err) {
    console.error('Delete report error:', err);
    res.status(500).send('Server error');
  }
});

// @route   POST api/reports/upload
// @desc    Upload file (returns URL/base64 representation)
// @access  Private
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    // Return the relative URL path to retrieve file locally
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).send('Server error');
  }
});

// @route   POST api/reports/export/docx
// @desc    Export report as Word document
// @access  Private
router.post('/export/docx', auth, async (req, res) => {
  try {
    const { generateReportDocx } = require('../docxGenerator');
    const buffer = await generateReportDocx(req.body);
    res.setHeader('Content-Disposition', 'attachment; filename=activity_report.docx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (err) {
    console.error('DOCX Export error:', err);
    res.status(500).send('Word document generation failed');
  }
});

module.exports = router;
