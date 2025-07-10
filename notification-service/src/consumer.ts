import { ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "./utils/sqsClient";
import { sendEmailAlert } from "./utils/sendEmailAlert"; // ✅ import your email function
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ALERT_QUEUE_URL = process.env.ALERT_QUEUE_URL!;
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || "test@example.com"; // can also make configurable

export async function pollAlertQueue() {
  const command = new ReceiveMessageCommand({
    QueueUrl: ALERT_QUEUE_URL,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 10,
  });

  const response = await sqsClient.send(command);

  if (response.Messages && response.Messages.length > 0) {
    for (const msg of response.Messages) {
      console.log("📥 Received alert message:", msg.Body);

      // ✅ Send email alert
      const subject = "🚨 Fuel Theft Alert";
      const htmlBody = `
        <h2>⚠️ Alert: Possible Fuel Theft</h2>
        <p>${msg.Body}</p>
        <p>Please check the PetroShield dashboard for details.</p>
      `;

      try {
        await sendEmailAlert(ALERT_EMAIL_TO, subject, htmlBody,);
        console.log("✅ Email alert sent");

        // ✅ Optionally log notification to DB
        await prisma.notificationLog.create({
          data: {
            userId: "system", // or actual userId if known
            message: msg.Body || "",
            status: "SENT",
          },
        });
        console.log("✅ Notification log saved");
      } catch (err) {
        console.error("❌ Error sending email or saving log:", err);
      }

      // ✅ Delete the message from SQS
      await sqsClient.send(new DeleteMessageCommand({
        QueueUrl: ALERT_QUEUE_URL,
        ReceiptHandle: msg.ReceiptHandle!,
      }));
      console.log("✅ Alert message deleted from SQS");
    }
  }
}





// Example IAM policy for SQS permissions
// This policy should be attached to the IAM role used by your microservices to receive messages from the SQS queue.

// {
//   "Effect": "Allow",
//   "Action": ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
//   "Resource": "arn:aws:sqs:your-region:your-account-id:queue-name"
// }
