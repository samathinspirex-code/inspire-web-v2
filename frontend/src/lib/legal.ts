// Copied from inspire-ui-host policy pages (same wording).
export type LegalSection = { title: string; paragraphs?: string[]; bullets?: string[] };
export const LEGAL: Record<string, { eyebrow: string; title: string; introduction: string; sections: LegalSection[] }> = {
 "privacy-policy": {
  "eyebrow": "Legal",
  "title": "Privacy Policy",
  "introduction": "At Inspire College, your privacy is a priority. This policy explains how we collect, use and protect information when you register for or access our educational services online or on campus.",
  "sections": [
   {
    "title": "Information we collect",
    "bullets": [
     "Personal information such as your name, email, phone number, address, date of birth and NIC or passport details.",
     "Academic information including qualifications, transcripts and supporting documents.",
     "Payment information such as billing details, payment method and transaction records, handled securely by trusted payment partners.",
     "Usage information including IP address, device and browser details, access times and pages visited."
    ]
   },
   {
    "title": "How we use your information",
    "bullets": [
     "To manage course registration and academic records.",
     "To communicate about enrolment and academic progress.",
     "To improve our services and the user experience.",
     "To investigate misuse of website forms and protect the service from spam.",
     "To send marketing communications where you have provided consent.",
     "To meet legal and regulatory requirements."
    ]
   },
   {
    "title": "Data protection",
    "paragraphs": [
     "We use appropriate technical and organisational safeguards to protect personal data. No internet transmission or storage system, however, can be guaranteed to be completely secure."
    ]
   },
   {
    "title": "Third-party sharing",
    "paragraphs": [
     "We do not sell or trade personal data. We may share necessary information with:"
    ],
    "bullets": [
     "Educational or accreditation bodies for certification purposes.",
     "Service providers that support our operations, including learning platforms and payment gateways.",
     "Government or legal authorities where required by law."
    ]
   },
   {
    "title": "Cookies",
    "paragraphs": [
     "Our website may use cookies to improve browsing and understand engagement. You may disable cookies in your browser, although some features may then be limited."
    ]
   },
   {
    "title": "Your rights",
    "bullets": [
     "Access your personal data.",
     "Request corrections to your information.",
     "Withdraw consent where applicable."
    ]
   }
  ]
 },
 "refund-policy": {
  "eyebrow": "Legal",
  "title": "Refund & Cancellation Policy",
  "introduction": "Thank you for choosing Inspire College. Please read this policy carefully before making any payment for a programme delivered through our hybrid learning model.",
  "sections": [
   {
    "title": "Registration fees",
    "paragraphs": [
     "Once paid, the registration fee is non-refundable under all circumstances, including when a student decides not to continue or is unable to attend."
    ]
   },
   {
    "title": "Course withdrawals",
    "paragraphs": [
     "Withdrawal from a course after registration does not qualify for a full or partial refund."
    ]
   },
   {
    "title": "Cancellation by Inspire College",
    "paragraphs": [
     "If Inspire College cancels a course or programme, registered students will be contacted and offered the available options, which may include:"
    ],
    "bullets": [
     "Deferring enrolment to a future batch.",
     "Applying paid fees to another course or programme."
    ]
   },
   {
    "title": "Further assistance",
    "paragraphs": [
     "Our administration team is available to support your academic journey and clarify any concerns about payments, withdrawals or cancellations."
    ]
   }
  ]
 },
 "terms-conditions": {
  "eyebrow": "Legal",
  "title": "Terms & Conditions",
  "introduction": "By enrolling in an Inspire College programme or using our website, you agree to these terms and conditions. Please read them carefully.",
  "sections": [
   {
    "title": "1. Programme delivery",
    "paragraphs": [
     "Inspire College follows a hybrid learning model consisting of 70% online learning through our LMS and virtual platforms, and 30% live scheduled sessions, workshops and assessments. Students are responsible for attending both components according to their course schedule."
    ]
   },
   {
    "title": "2. Enrolment and payments",
    "bullets": [
     "Admission is confirmed only after the registration fee has been paid in full.",
     "Registration fees are non-refundable.",
     "Programme fees must be paid by the deadlines stated in the offer letter or invoice."
    ]
   },
   {
    "title": "3. Student conduct",
    "paragraphs": [
     "Students must attend online and in-person classes regularly, submit assignments and assessments on time, and communicate respectfully and professionally. Breaches of academic or conduct policies may result in disciplinary action or dismissal."
    ]
   },
   {
    "title": "4. Intellectual property",
    "paragraphs": [
     "Course materials, videos, notes and other learning content belong to Inspire College and may not be reproduced, shared or sold without written permission."
    ]
   },
   {
    "title": "5. Limitation of liability",
    "paragraphs": [
     "Inspire College is not responsible for damage or loss caused by technical issues, third-party tools or force majeure events outside our control."
    ]
   },
   {
    "title": "6. Amendments",
    "paragraphs": [
     "We may update these terms periodically. Students will be informed when significant changes are made."
    ]
   }
  ]
 }
};
