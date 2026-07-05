const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Users, Reports, Templates } = require('../dbHelper');
const { isConnected, getFallbackStore } = require('../db');

// Middleware to check if user is admin
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ msg: 'Access denied: Admin only' });
  }
};

// @route   GET api/admin/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
router.get('/users', [auth, adminOnly], async (req, res) => {
  try {
    const users = await Users.list();
    res.json(users);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).send('Server error');
  }
});

// @route   PUT api/admin/users/:id/role
// @desc    Update user role (Admin only)
// @access  Private/Admin
router.put('/users/:id/role', [auth, adminOnly], async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ msg: 'Invalid role' });
  }

  try {
    const user = await Users.updateRole(req.params.id, role);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json({ id: user._id || user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    console.error('Update user role error:', err);
    res.status(500).send('Server error');
  }
});

// @route   GET api/admin/templates
// @desc    Get all templates
// @access  Private
router.get('/templates', auth, async (req, res) => {
  try {
    const templates = await Templates.find();
    res.json(templates);
  } catch (err) {
    console.error('Fetch templates error:', err);
    res.status(500).send('Server error');
  }
});

// @route   POST api/admin/templates
// @desc    Create a template (Admin only)
// @access  Private/Admin
router.post('/templates', [auth, adminOnly], async (req, res) => {
  try {
    const templateData = {
      ...req.body,
      createdById: req.user.id,
      createdByIdFallback: req.user.id
    };
    const template = await Templates.save(templateData);
    res.json(template);
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).send('Server error');
  }
});

// @route   DELETE api/admin/templates/:id
// @desc    Delete a template (Admin only)
// @access  Private/Admin
router.delete('/templates/:id', [auth, adminOnly], async (req, res) => {
  try {
    const success = await Templates.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ msg: 'Template not found' });
    }
    res.json({ msg: 'Template deleted successfully' });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).send('Server error');
  }
});

// @route   GET api/admin/backup
// @desc    Backup all system data to JSON (Admin only)
// @access  Private/Admin
router.get('/backup', [auth, adminOnly], async (req, res) => {
  try {
    let backupData = {};
    
    if (isConnected()) {
      // Fetch mongoose collections
      const mongoose = require('mongoose');
      const collections = Object.keys(mongoose.connection.collections);
      for (const colName of collections) {
        const docs = await mongoose.connection.collections[colName].find({}).toArray();
        backupData[colName] = docs;
      }
    } else {
      // Read JSON file fallback database
      backupData = getFallbackStore().read();
    }
    
    res.setHeader('Content-disposition', 'attachment; filename=activity_report_backup.json');
    res.setHeader('Content-type', 'application/json');
    res.json(backupData);
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).send('Server backup error');
  }
});

// @route   POST api/admin/restore
// @desc    Restore database from backup JSON (Admin only)
// @access  Private/Admin
router.post('/restore', [auth, adminOnly], async (req, res) => {
  const backupData = req.body;
  if (!backupData || (typeof backupData !== 'object')) {
    return res.status(400).json({ msg: 'Invalid backup format' });
  }

  try {
    if (isConnected()) {
      const mongoose = require('mongoose');
      
      // Clear and restore each collection
      for (const colName of Object.keys(backupData)) {
        if (!backupData[colName] || !Array.isArray(backupData[colName])) continue;
        const col = mongoose.connection.collections[colName];
        if (col) {
          await col.deleteMany({});
          if (backupData[colName].length > 0) {
            // Restore original ObjectIds
            const docs = backupData[colName].map(doc => {
              if (doc._id && typeof doc._id === 'string') {
                doc._id = new mongoose.Types.ObjectId(doc._id);
              }
              return doc;
            });
            await col.insertMany(docs);
          }
        }
      }
    } else {
      // Overwrite JSON fallback database
      const store = getFallbackStore();
      const currentData = store.read();
      
      const restored = {
        users: backupData.users || backupData.UserModel || currentData.users || [],
        reports: backupData.reports || backupData.ReportModel || currentData.reports || [],
        templates: backupData.templates || backupData.TemplateModel || currentData.templates || []
      };
      
      store.write(restored);
    }
    
    res.json({ msg: 'Database restored successfully' });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).send('Restore failed');
  }
});

module.exports = router;
