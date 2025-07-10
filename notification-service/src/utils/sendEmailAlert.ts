import { createTransporter } from "./emailTransporter";

export async function sendEmailAlert(to: string, subject: string, htmlBody: string) {
  const transporter = createTransporter();

  const mailOptions = {
    from: '"PetroShield Alerts" <alerts@petroshield.com>', // can customize
    to,
    subject,
    html: htmlBody,
    text: htmlBody.replace(/<[^>]+>/g, ""), // fallback plain text
    // text: textBody, // use this if you want to send a separate plain text body 
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
  } catch (err) {
    console.error("❌ Error sending email:", err);
    throw err;
  }
}
