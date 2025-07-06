import nodemailer from 'nodemailer';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { name, email, message, attachments = [] } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email ve message alanları zorunludur' });
  }

  try {
    // Puppeteer ile PDF üretimi - Vercel için optimize edilmiş
    const browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection'
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    await page.setContent(message, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm'
      }
    });

    await browser.close();

    // E-posta gönderimi
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // Attachment'ları hazırla
    const emailAttachments = [];
    
    // PDF'i ekle
    emailAttachments.push({
      filename: 'refakat-form.pdf',
      content: pdfBuffer,
      contentType: 'application/pdf'
    });

    // İmza dosyalarını ekle (varsa)
    if (attachments && attachments.length > 0) {
      attachments.forEach(att => {
        if (att.content && att.filename) {
          emailAttachments.push({
            filename: att.filename,
            content: att.content.replace(/^data:image\/[a-z]+;base64,/, ''),
            encoding: 'base64'
          });
        }
      });
    }

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: `ISS Refakat Formu PDF: ${name}`,
      text: 'Ekli PDF dosyasında refakat formu ve imzalar yer almaktadır.',
      attachments: emailAttachments
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      attachmentCount: emailAttachments.length,
      message: 'PDF başarıyla üretildi ve e-posta ile gönderildi.'
    });
  } catch (err) {
    console.error('Mail gönderim hatası:', err);
    res.status(500).json({
      error: 'E-posta gönderimi başarısız.',
      details: err.message
    });
  }
}
