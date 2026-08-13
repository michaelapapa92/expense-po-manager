export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#2D1810] mb-2" data-testid="text-privacy-title">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-500" data-testid="text-privacy-effective-date">
            Effective Date: February 17, 2026
          </p>
        </div>

        <div className="prose prose-slate max-w-none space-y-6 text-sm leading-relaxed text-slate-700">
          <p>
            Aseva ("Company," "we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the ReimburseFlow application ("Application"). By using the Application, you consent to the practices described in this policy.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">1. Information We Collect</h2>

          <h3 className="text-base font-semibold text-[#2D1810] mt-4">Personal Information</h3>
          <p>We collect personal information that you or your organization provide, including:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Name and email address</li>
            <li>Department and role within your organization</li>
            <li>Phone number (if provided for notifications)</li>
            <li>Profile image (if provided)</li>
          </ul>

          <h3 className="text-base font-semibold text-[#2D1810] mt-4">Expense Data</h3>
          <p>We collect information related to expense reports, including:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Expense descriptions, amounts, dates, and categories</li>
            <li>Receipt images and supporting documentation</li>
            <li>Mileage records</li>
            <li>Notes and comments on expense reports</li>
            <li>Approval history and status changes</li>
          </ul>

          <h3 className="text-base font-semibold text-[#2D1810] mt-4">Authentication Data</h3>
          <p>
            We receive authentication tokens and identifiers from your organization's identity provider (OneLogin) when you sign in. We do not store your password.
          </p>

          <h3 className="text-base font-semibold text-[#2D1810] mt-4">Usage Data</h3>
          <p>
            We may collect information about how you access and use the Application, including session data and interaction logs necessary for the Application to function.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Process and manage expense reports through the approval workflow</li>
            <li>Authenticate your identity and maintain your session</li>
            <li>Send notifications about expense report status changes (in-app, email, and/or Webex, based on your preferences)</li>
            <li>Generate reports and analytics for authorized users</li>
            <li>Scan receipts using AI to extract expense details</li>
            <li>Synchronize expense data with connected accounting systems</li>
            <li>Maintain an audit trail of expense report changes</li>
            <li>Improve and maintain the Application</li>
          </ul>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">3. Third-Party Services</h2>
          <p>
            We share your information with the following third-party services only as necessary for the Application to function:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>OneLogin</strong> — For single sign-on authentication. We receive your name, email, and unique identifier.</li>
            <li><strong>Microsoft 365 (Graph API)</strong> — For sending email notifications when enabled. Email content includes expense details and status updates.</li>
            <li><strong>Webex</strong> — For sending direct message notifications when enabled by the user.</li>
            <li><strong>OpenAI</strong> — For AI-powered receipt scanning. Receipt images are sent to OpenAI's API for text extraction. OpenAI's data usage policies apply.</li>
            <li><strong>QuickBooks Online (Intuit)</strong> — When connected by an administrator, expense data (descriptions, amounts, vendor names) is shared with QuickBooks Online to create bills and synchronize payment status. You can disconnect this integration at any time.</li>
          </ul>
          <p>
            Each third-party service is governed by its own privacy policy. We encourage you to review their policies.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">4. Data Storage and Security</h2>
          <p>
            Your data is stored in a secure PostgreSQL database. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Encrypted connections (HTTPS/TLS) for all data in transit</li>
            <li>Secure session management with server-side session storage</li>
            <li>Role-based access controls limiting data visibility to authorized users</li>
            <li>OAuth tokens for third-party integrations stored securely on the server</li>
          </ul>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">5. Data Retention</h2>
          <p>
            We retain your personal information and expense data for as long as your account is active or as needed to provide services to your organization. Expense records and audit trails may be retained longer as required for accounting, legal, or regulatory purposes.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">6. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate personal information</li>
            <li>Request deletion of your personal information, subject to legal retention requirements</li>
            <li>Opt out of non-essential notifications through your profile settings</li>
            <li>Request a copy of your data in a portable format</li>
          </ul>
          <p>
            To exercise any of these rights, please contact us using the information below.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">7. Notification Preferences</h2>
          <p>
            You can control how you receive notifications through your profile settings in the Application. You may enable or disable email notifications, Webex notifications, and text notifications independently.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">8. Children's Privacy</h2>
          <p>
            The Application is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be posted within the Application with an updated effective date. Your continued use of the Application after changes are posted constitutes your acceptance of the updated policy.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">10. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy or our data practices, please contact us at{" "}
            <a href="mailto:expenses@aseva.com" className="text-[#0D9488] hover:underline">
              expenses@aseva.com
            </a>.
          </p>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Aseva. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
