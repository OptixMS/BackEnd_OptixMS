const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'nashrthunder221@gmail.com',
    pass: 'smfz yqzn cbse bthe',
  },
});

async function getHTML(template, data) {
  const filePath = path.join(__dirname, '..', 'views', template);
  const file = fs.readFileSync(filePath, 'utf8');
  return ejs.render(file, data);
}

async function sendMail(to, subject, html) {
  return transporter.sendMail({
    from: 'youremail@gmail.com',
    to,
    subject,
    html,
  });
}

module.exports = { getHTML, sendMail };
