const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { isConnected, getFallbackStore } = require('./db');

// --- MONGOOSE SCHEMAS ---

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  avatar: { type: String, default: '' }
}, { timestamps: true });

const ReportSchema = new mongoose.Schema({
  title: { type: String, default: 'ACTIVITY REPORT ON' },
  titleStyles: {
    fontFamily: { type: String, default: 'Times New Roman' },
    fontSize: { type: Number, default: 24 },
    color: { type: String, default: '#000000' },
    bold: { type: Boolean, default: true },
    italic: { type: Boolean, default: false },
    underline: { type: Boolean, default: false },
    align: { type: String, default: 'center' },
    backgroundColor: { type: String, default: 'transparent' },
    letterSpacing: { type: Number, default: 0 },
    lineSpacing: { type: Number, default: 1.2 },
    textCase: { type: String, default: 'none' },
    padding: { type: Number, default: 10 },
    border: { type: String, default: 'none' },
    borderRadius: { type: Number, default: 0 }
  },
  headerStyles: {
    fontFamily: { type: String, default: 'Times New Roman' },
    fontSize: { type: Number, default: 12 },
    color: { type: String, default: '#000000' },
    bold: { type: Boolean, default: true },
    italic: { type: Boolean, default: false },
    underline: { type: Boolean, default: false },
    align: { type: String, default: 'center' },
    backgroundColor: { type: String, default: '#ffffff' },
    height: { type: Number, default: 60 },
    spacing: { type: Number, default: 15 },
    showBorder: { type: Boolean, default: true },
    visible: { type: Boolean, default: true },
    institutionName: { type: String, default: "St. Joseph's Engineering College" }
  },
  imageConfig: {
    layoutType: { type: String, default: 'grid' },
    columns: { type: Number, default: 2 },
    aspectRatio: { type: String, default: 'maintain' },
    maxPerPage: { type: Number, default: 4 },
    alignment: { type: String, default: 'center' }
  },
  logos: [{
    id: String,
    src: String, // base64 or url
    visible: { type: Boolean, default: true },
    label: String
  }],
  infoTable: {
    rows: [{
      id: String,
      name: String,
      value: String,
      visible: { type: Boolean, default: true },
      required: { type: Boolean, default: false },
      order: Number
    }],
    styles: {
      showBorder: { type: Boolean, default: true },
      headerBg: { type: String, default: '#f3f4f6' },
      headerColor: { type: String, default: '#000000' },
      alternateRowBg: { type: String, default: '#ffffff' },
      alternateRowColor: { type: String, default: '#f9fafb' },
      cellPadding: { type: Number, default: 8 },
      fontSize: { type: Number, default: 11 },
      fontFamily: { type: String, default: 'Times New Roman' },
      borderThickness: { type: Number, default: 1 },
      borderRadius: { type: Number, default: 0 },
      rowHeight: { type: Number, default: 40 },
      colWidth: { type: Number, default: 35 },
      align: { type: String, default: 'left' }
    }
  },
  fields: [{
    id: String,
    heading: String,
    description: String,
    type: { type: String, default: 'text' }, // text, list, custom
    order: Number
  }],
  photos: [{
    id: String,
    src: String,
    caption: String,
    order: Number
  }],
  signatures: [{
    id: String,
    designation: String,
    name: String,
    image: String, // signature image base64/url
    type: { type: String, default: 'upload' }, // upload, digital (drawn)
    order: Number
  }],
  footer: {
    visible: { type: Boolean, default: true },
    text: { type: String, default: '' },
    website: { type: String, default: '' },
    email: { type: String, default: '' },
    qrCode: { type: String, default: '' }, // base64 QR
    socials: { type: Map, of: String, default: {} }
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  userIdFallback: String, // string id for JSON database
  isTemplate: { type: Boolean, default: false },
  version: { type: Number, default: 1 },
  history: [{
    version: Number,
    updatedAt: Date,
    updatedBy: String,
    title: String,
    fields: Array
  }]
}, { timestamps: true });

const TemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  title: { type: String, default: 'ACTIVITY REPORT ON' },
  titleStyles: Object,
  logos: Array,
  infoTable: Object,
  fields: Array,
  signatures: Array,
  footer: Object,
  createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByIdFallback: String
}, { timestamps: true });

let UserModel, ReportModel, TemplateModel;

try {
  UserModel = mongoose.model('User', UserSchema);
  ReportModel = mongoose.model('Report', ReportSchema);
  TemplateModel = mongoose.model('Template', TemplateSchema);
} catch (e) {
  UserModel = mongoose.models.User;
  ReportModel = mongoose.models.Report;
  TemplateModel = mongoose.models.Template;
}

// --- UNIFIED HELPERS ---

const Users = {
  async findByEmail(email) {
    if (isConnected()) {
      return await UserModel.findOne({ email });
    } else {
      const collection = await getFallbackStore().getCollection('users');
      return collection.find(u => u.email === email) || null;
    }
  },

  async findById(id) {
    if (isConnected()) {
      return await UserModel.findById(id);
    } else {
      const collection = await getFallbackStore().getCollection('users');
      return collection.find(u => (u._id || u.id) === id) || null;
    }
  },

  async create(userData) {
    const salt = await bcrypt.genSalt(10);
    userData.password = await bcrypt.hash(userData.password, salt);

    if (isConnected()) {
      const user = new UserModel(userData);
      return await user.save();
    } else {
      const user = { ...userData };
      return await getFallbackStore().save('users', user);
    }
  },

  async list() {
    if (isConnected()) {
      return await UserModel.find({}, '-password');
    } else {
      const collection = await getFallbackStore().getCollection('users');
      return collection.map(({ password, ...u }) => u);
    }
  },
  
  async updateRole(id, role) {
    if (isConnected()) {
      return await UserModel.findByIdAndUpdate(id, { role }, { new: true });
    } else {
      const user = await this.findById(id);
      if (!user) return null;
      user.role = role;
      return await getFallbackStore().save('users', user);
    }
  }
};

const Reports = {
  async find(query = {}) {
    if (isConnected()) {
      // Convert queries from fallback representation if any
      const mongoQuery = { ...query };
      if (mongoQuery.userIdFallback) {
        mongoQuery.userId = mongoQuery.userIdFallback;
        delete mongoQuery.userIdFallback;
      }
      return await ReportModel.find(mongoQuery).sort({ updatedAt: -1 });
    } else {
      let collection = await getFallbackStore().getCollection('reports');
      // Apply filters
      if (query.userIdFallback) {
        collection = collection.filter(r => r.userIdFallback === query.userIdFallback);
      }
      if (query.isTemplate !== undefined) {
        collection = collection.filter(r => r.isTemplate === query.isTemplate);
      }
      return collection.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
  },

  async findById(id) {
    if (isConnected()) {
      return await ReportModel.findById(id);
    } else {
      const collection = await getFallbackStore().getCollection('reports');
      return collection.find(r => (r._id || r.id) === id) || null;
    }
  },

  async save(reportData) {
    if (isConnected()) {
      if (reportData._id || reportData.id) {
        const id = reportData._id || reportData.id;
        delete reportData._id;
        delete reportData.id;
        return await ReportModel.findByIdAndUpdate(id, reportData, { new: true });
      } else {
        const report = new ReportModel(reportData);
        return await report.save();
      }
    } else {
      return await getFallbackStore().save('reports', reportData);
    }
  },

  async delete(id) {
    if (isConnected()) {
      const res = await ReportModel.findByIdAndDelete(id);
      return !!res;
    } else {
      return await getFallbackStore().delete('reports', id);
    }
  }
};

const Templates = {
  async find(query = {}) {
    if (isConnected()) {
      return await TemplateModel.find(query).sort({ createdAt: -1 });
    } else {
      const collection = await getFallbackStore().getCollection('templates');
      return collection.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  },

  async findById(id) {
    if (isConnected()) {
      return await TemplateModel.findById(id);
    } else {
      const collection = await getFallbackStore().getCollection('templates');
      return collection.find(t => (t._id || t.id) === id) || null;
    }
  },

  async save(templateData) {
    if (isConnected()) {
      if (templateData._id || templateData.id) {
        const id = templateData._id || templateData.id;
        delete templateData._id;
        delete templateData.id;
        return await TemplateModel.findByIdAndUpdate(id, templateData, { new: true });
      } else {
        const template = new TemplateModel(templateData);
        return await template.save();
      }
    } else {
      return await getFallbackStore().save('templates', templateData);
    }
  },

  async delete(id) {
    if (isConnected()) {
      const res = await TemplateModel.findByIdAndDelete(id);
      return !!res;
    } else {
      return await getFallbackStore().delete('templates', id);
    }
  }
};

module.exports = {
  Users,
  Reports,
  Templates
};
