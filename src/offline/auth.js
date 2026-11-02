const { HttpError } = require('../util');
const adminOnly = (req, res, next) => (req.role === 'admin' ? next() : next(new HttpError(403, 'Bu amal faqat Admin uchun.')));
module.exports = { adminOnly };
