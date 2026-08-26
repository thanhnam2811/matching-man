import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

export interface SentEmailRecord {
    to: string;
    subject: string;
    html: string;
    sentAt: Date;
}

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly resend: Resend | null = null;
    private readonly emailFrom: string;
    private readonly appWebUrl: string;
    private readonly sentEmailsHistory: SentEmailRecord[] = [];

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>("RESEND_API_KEY");
        if (apiKey) {
            this.resend = new Resend(apiKey);
        }
        this.emailFrom = this.configService.get<string>("EMAIL_FROM") ?? "Matching Hub <noreply@matching-man.dev>";
        this.appWebUrl = this.configService.get<string>("APP_WEB_URL") ?? "http://localhost:3001";
    }

    async sendPasswordResetEmail(to: string, token: string): Promise<void> {
        const resetUrl = `${this.appWebUrl}/reset-password?token=${encodeURIComponent(token)}`;
        const subject = "Reset your Matching Hub password";
        const html = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: sans-serif; line-height: 1.5; color: #18181b; padding: 20px;">
                <h2>Password Reset Request</h2>
                <p>We received a request to reset the password for your Matching Hub account.</p>
                <p>Click the button below to reset your password. This link is valid for <strong>15 minutes</strong>.</p>
                <p style="margin: 24px 0;">
                    <a href="${resetUrl}" style="background-color: #18181b; color: #fafafa; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Reset Password</a>
                </p>
                <p style="font-size: 13px; color: #71717a;">If you did not request a password reset, you can safely ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
                <p style="font-size: 12px; color: #a1a1aa;">Matching Hub — Real-time Matchmaking Platform</p>
            </body>
            </html>
        `;

        await this.deliverEmail(to, subject, html);
    }

    async sendEmailVerification(to: string, token: string): Promise<void> {
        const verifyUrl = `${this.appWebUrl}/verify-email?token=${encodeURIComponent(token)}`;
        const subject = "Verify your email address - Matching Hub";
        const html = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: sans-serif; line-height: 1.5; color: #18181b; padding: 20px;">
                <h2>Welcome to Matching Hub!</h2>
                <p>Please confirm your email address by clicking the link below:</p>
                <p style="margin: 24px 0;">
                    <a href="${verifyUrl}" style="background-color: #18181b; color: #fafafa; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Verify Email</a>
                </p>
                <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
                <p style="font-size: 12px; color: #a1a1aa;">Matching Hub — Real-time Matchmaking Platform</p>
            </body>
            </html>
        `;

        await this.deliverEmail(to, subject, html);
    }

    async sendPaymentFailedEmail(to: string, organizationName: string, portalUrl: string): Promise<void> {
        const subject = `[Action Required] Payment failed for ${organizationName} on Matching Hub`;
        const html = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: sans-serif; line-height: 1.5; color: #18181b; padding: 20px;">
                <h2>Payment Failed</h2>
                <p>We were unable to charge your payment method for organization <strong>${organizationName}</strong>.</p>
                <p>Your service is currently in a 7-day grace period. Please update your payment method to prevent any disruption to your live matchmaking queues:</p>
                <p style="margin: 24px 0;">
                    <a href="${portalUrl}" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Update Payment Method</a>
                </p>
                <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
                <p style="font-size: 12px; color: #a1a1aa;">Matching Hub — Real-time Matchmaking Platform</p>
            </body>
            </html>
        `;

        await this.deliverEmail(to, subject, html);
    }

    getSentEmails(): SentEmailRecord[] {
        return [...this.sentEmailsHistory];
    }

    clearSentEmails(): void {
        this.sentEmailsHistory.length = 0;
    }

    private async deliverEmail(to: string, subject: string, html: string): Promise<void> {
        this.sentEmailsHistory.push({ to, subject, html, sentAt: new Date() });

        if (this.resend) {
            try {
                await this.resend.emails.send({
                    from: this.emailFrom,
                    to,
                    subject,
                    html,
                });
                this.logger.log(`Transactional email sent to ${to}: "${subject}"`);
            } catch (err: any) {
                this.logger.error(`Failed to send email via Resend to ${to}: ${err.message}`, err.stack);
            }
        } else {
            this.logger.log(`[DEV/TEST EMAIL] To: ${to} | Subject: "${subject}"`);
        }
    }
}
