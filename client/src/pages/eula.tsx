export default function EULA() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#2D1810] mb-2" data-testid="text-eula-title">
            End User License Agreement
          </h1>
          <p className="text-sm text-slate-500" data-testid="text-eula-effective-date">
            Effective Date: February 17, 2026
          </p>
        </div>

        <div className="prose prose-slate max-w-none space-y-6 text-sm leading-relaxed text-slate-700">
          <p>
            This End User License Agreement ("Agreement") is a legal agreement between you ("User") and Aseva ("Company," "we," "us," or "our") governing your use of the ReimburseFlow application ("Application"). By accessing or using the Application, you agree to be bound by the terms of this Agreement.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">1. License Grant</h2>
          <p>
            Subject to the terms of this Agreement, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Application solely for your internal business purposes related to expense reporting and reimbursement management.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">2. Permitted Use</h2>
          <p>You may use the Application to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Submit, review, and manage expense reports</li>
            <li>Process expense approvals through the designated workflow</li>
            <li>Upload receipts and supporting documentation</li>
            <li>Generate reports related to expense management</li>
            <li>Integrate with third-party services such as QuickBooks Online for accounting purposes</li>
          </ul>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">3. Third-Party Integrations</h2>
          <p>
            The Application may integrate with third-party services, including but not limited to Intuit QuickBooks Online, Microsoft 365, OneLogin, and OpenAI. Your use of these third-party services is subject to their respective terms of service and privacy policies. We are not responsible for the availability, accuracy, or practices of any third-party services.
          </p>
          <p>
            When you connect your QuickBooks Online account, you authorize the Application to create bills, check payment statuses, and synchronize data between the Application and your QuickBooks Online account. You may disconnect the integration at any time through the Application's admin settings.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">4. User Accounts and Authentication</h2>
          <p>
            Access to the Application requires authentication through our designated identity provider. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">5. Data and Privacy</h2>
          <p>
            We collect and process personal and financial data necessary for the operation of the Application, including but not limited to your name, email address, expense details, receipt images, and approval records. All data is stored securely and processed in accordance with applicable data protection laws.
          </p>
          <p>
            We do not sell your personal data to third parties. Data shared with third-party integrations (such as QuickBooks Online) is limited to what is necessary for the integration to function as described.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">6. Restrictions</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Copy, modify, distribute, or create derivative works of the Application</li>
            <li>Reverse engineer, decompile, or disassemble any part of the Application</li>
            <li>Use the Application for any unlawful purpose or in violation of any applicable laws</li>
            <li>Attempt to gain unauthorized access to the Application or its related systems</li>
            <li>Submit fraudulent expense reports or documentation</li>
            <li>Share your account credentials with unauthorized individuals</li>
          </ul>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">7. Intellectual Property</h2>
          <p>
            The Application and all related content, features, and functionality are owned by the Company and are protected by copyright, trademark, and other intellectual property laws. This Agreement does not transfer any ownership rights to you.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">8. Disclaimer of Warranties</h2>
          <p>
            THE APPLICATION IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE APPLICATION WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">9. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE COMPANY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE APPLICATION, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">10. Termination</h2>
          <p>
            We may terminate or suspend your access to the Application at any time, with or without cause, and with or without notice. Upon termination, your right to use the Application will immediately cease. All provisions of this Agreement that by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, and limitations of liability.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">11. Changes to This Agreement</h2>
          <p>
            We reserve the right to modify this Agreement at any time. Changes will be effective when posted within the Application. Your continued use of the Application after changes are posted constitutes your acceptance of the modified Agreement.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">12. Governing Law</h2>
          <p>
            This Agreement shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of law provisions.
          </p>

          <h2 className="text-lg font-semibold text-[#2D1810] mt-8">13. Contact</h2>
          <p>
            If you have any questions about this Agreement, please contact us at{" "}
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
