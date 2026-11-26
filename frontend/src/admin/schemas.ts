// What each CMS section edits. Field keys map to backend columns; "detail.x" edits a key inside the JSON column.
export type Field = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "bool" | "select" | "json" | "image" | "video" | "date" | "lines";
  options?: string[];
  help?: string;
  wide?: boolean;
};
export type Section = { name: string; title: string; singular: string; columns: string[]; fields: Field[]; newItem: Record<string, unknown>; help?: string };

const status: Field = { key: "status", label: "Status", type: "select", options: ["published", "draft"] };
const order: Field = { key: "sort_order", label: "Order", type: "number", help: "Lower shows first" };

export const SECTIONS: Section[] = [
  {
    name: "courses", title: "Courses", singular: "course",
    help: "Courses shown on the home page, programme pages, enrol drawer and catalogue. Featured courses appear on the home grid.",
    columns: ["title", "level", "fee_label", "featured", "status"],
    newItem: { key: "", slug: "", title: "", level: "Short course", plan_type: "cpd", status: "draft", featured: false, sort_order: 100, detail: {} },
    fields: [
      { key: "title", label: "Full name", wide: true },
      { key: "short", label: "Short name", help: "e.g. HND · Software Engineering" },
      { key: "slug", label: "URL slug", help: "Page address: /programs/<slug>. Keep the current site's slug." },
      { key: "key", label: "Design key", help: "Internal id used by the page (e.g. hnd-se). Don't change for existing courses." },
      { key: "level", label: "Level", type: "select", options: ["HND", "Foundation", "Top-Up", "Postgraduate", "Short course"] },
      { key: "plan_type", label: "Fee plan type", type: "select", options: ["hnd", "fnd", "pg", "cpd"], help: "hnd / fnd use the fee plans in Website settings; cpd = pay in full; pg = advisor sets the plan" },
      { key: "school", label: "School", help: "Computing, Business, CPD…" },
      { key: "body", label: "Awarding body", help: "e.g. ATHE (UK)" },
      { key: "duration", label: "Duration" },
      { key: "fee", label: "Fee (LKR)", type: "number" },
      { key: "fee_label", label: "Fee label", help: "e.g. from LKR 280,000" },
      { key: "monthly_label", label: "Monthly line", help: "e.g. or LKR 9,999 a month · limited offer" },
      { key: "cpd_addon_fee", label: "CPD add-on price (LKR)", type: "number", help: "Only for short courses offered as add-ons (25% off in the enrol drawer)" },
      { key: "image", label: "Image", type: "image", wide: true },
      { key: "blurb", label: "Card text", type: "textarea", wide: true },
      { key: "card_type", label: "Card label", help: "e.g. HND · AI" },
      { key: "keywords", label: "Search keywords" },
      { key: "featured", label: "Show on home page grid", type: "bool" },
      { key: "auto_instalments", label: "Automatic instalments", type: "bool", help: "Monthly plans: after the registration payment, create the monthly invoices and email each one before it is due (with reminders)" },
      order, status,
      { key: "detail.overview", label: "Programme overview", type: "textarea", wide: true },
      { key: "detail.entry", label: "Entry requirements", type: "textarea", wide: true },
      { key: "detail.skills", label: "Skills (one per line)", type: "lines" },
      { key: "detail.careers", label: "Careers (one per line)", type: "lines" },
      { key: "detail.feeTitle", label: "Fee section title" },
      { key: "detail.feeNote", label: "Fee note", type: "textarea" },
      { key: "seo_title", label: "SEO title", wide: true },
      { key: "seo_description", label: "SEO description", type: "textarea", wide: true },
      { key: "detail", label: "All programme page fields (advanced)", type: "json", wide: true, help: "Every field the programme page uses: years, fees table, who, path, chip, startAmt…" },
    ],
  },
  {
    name: "testimonials", title: "Student stories", singular: "story", columns: ["name", "role", "status"],
    newItem: { name: "", role: "", status: "draft", sort_order: 100 },
    fields: [
      { key: "name", label: "Name" }, { key: "role", label: "Programme line", help: "e.g. HND · Inspire College" },
      { key: "image", label: "Photo", type: "image", wide: true }, { key: "image_pos", label: "Photo focus", help: "CSS position, e.g. 60%" },
      { key: "video_url", label: "Video", type: "video", wide: true }, { key: "caption", label: "Caption", type: "textarea", wide: true }, order, status,
    ],
  },
  {
    name: "demo_classes", title: "Demo LMS classes", singular: "class", columns: ["code", "title", "programme", "study_mode", "status", "published"],
    help: "Classes students see under My Classes in the free-demo LMS (/portal). Use \"Course content\" to add sections, videos, PDFs, slides and lessons, like the lecturer panel in the current LMS.",
    newItem: { code: "", title: "", awarding_body: "ATHE (UK)", school: "School of Computing", programme: "", intake: "September", study_mode: "Full Time",
      start_date: null, end_date: null, lecturers: "", status: "Active", image: "", description: "", takeaways: "", sort_order: 100, published: "draft" },
    fields: [
      { key: "code", label: "Class code", help: "e.g. B_L3_M5" }, { key: "title", label: "Class / module title", help: "e.g. Market Research" },
      { key: "awarding_body", label: "Awarding body", type: "select", options: ["ATHE (UK)", "CPD UK", "Jain University", "LSBF Singapore"] },
      { key: "school", label: "School", type: "select", options: ["School of Computing", "School of Business", "School of Education", "School of CPD"] },
      { key: "programme", label: "Programme", help: "e.g. HND · Software Engineering" },
      { key: "intake", label: "Intake", help: "e.g. September" },
      { key: "study_mode", label: "Study mode", type: "select", options: ["Full Time", "Part Time"] },
      { key: "status", label: "Class status", type: "select", options: ["Planned", "Active", "Completed"] },
      { key: "start_date", label: "Start date", type: "date" }, { key: "end_date", label: "End date", type: "date" },
      { key: "lecturers", label: "Lecturers", help: "Comma-separated names", wide: true },
      { key: "image", label: "Class banner", type: "image", wide: true },
      { key: "description", label: "About this class", type: "textarea", wide: true, help: "Shown on the class Details tab" },
      { key: "takeaways", label: "Takeaways from this course", type: "textarea", wide: true, help: "One per line" },
      { key: "published", label: "Show in demo LMS", type: "select", options: ["published", "draft"] }, order,
    ],
  },
  {
    name: "leaders", title: "Leadership", singular: "leader", columns: ["name", "role", "status"],
    newItem: { name: "", role: "", initials: "", photo: "", photo_pos: "center 20%", bio: "", status: "draft", sort_order: 100 },
    fields: [
      { key: "name", label: "Name" }, { key: "role", label: "Role" },
      { key: "photo", label: "Profile photo", type: "image", help: "Square or portrait photo. Shown in a fixed frame." },
      { key: "photo_pos", label: "Photo focus", help: "Which part stays in frame, e.g. 'center 20%' (top) or 'center' (middle)" },
      { key: "bio", label: "Short description", type: "textarea", wide: true, help: "One or two sentences shown on the card" },
      { key: "initials", label: "Initials", help: "Shown only when there is no photo" }, order, status,
    ],
  },
  {
    name: "faqs", title: "FAQs", singular: "FAQ", columns: ["question", "audience", "status"],
    newItem: { audience: "student", question: "", answer: "", status: "draft", sort_order: 100 },
    fields: [
      { key: "audience", label: "Shown to", type: "select", options: ["student", "parent"] },
      { key: "question", label: "Question", wide: true }, { key: "answer", label: "Answer", type: "textarea", wide: true }, order, status,
    ],
  },
  {
    name: "campaigns", title: "Campaigns & offers", singular: "campaign", columns: ["key", "tag", "status"],
    help: "The strip at the top of the home page and the perks in the enrol drawer. The default campaign is set in Website settings.",
    newItem: { key: "", tag: "", text: "", short: "", perk: "", status: "draft", sort_order: 100 },
    fields: [
      { key: "key", label: "Key", help: "scholarship, intake, referral, coffee…" }, { key: "tag", label: "Tag" },
      { key: "text", label: "Headline", type: "textarea", wide: true }, { key: "short", label: "Short line", wide: true },
      { key: "perk", label: "Perk after enrolling", wide: true }, order, status,
    ],
  },
  {
    name: "news", title: "News & events", singular: "news item", columns: ["title", "category", "published_at", "status"],
    newItem: { slug: "", title: "", category: "News", status: "draft", sort_order: 100 },
    fields: [
      { key: "title", label: "Title", wide: true }, { key: "slug", label: "URL slug", help: "/news/<slug>" },
      { key: "category", label: "Category" }, { key: "published_at", label: "Published", type: "date" },
      { key: "excerpt", label: "Summary", type: "textarea", wide: true }, { key: "image", label: "Image", type: "image", wide: true },
      { key: "video_url", label: "Video", type: "video", wide: true }, { key: "body", label: "Article (blank line between paragraphs)", type: "textarea", wide: true },
      order, status,
    ],
  },
  {
    name: "redirects", title: "Redirects", singular: "redirect", columns: ["source", "destination", "permanent", "gone"],
    help: "Extra redirects on top of the built-in ones copied from the current site. Paths start with /.",
    newItem: { source: "/", destination: "/", permanent: true, gone: false },
    fields: [
      { key: "source", label: "Old path", help: "e.g. /old-page" }, { key: "destination", label: "Go to", help: "e.g. /programs/ai-mastery" },
      { key: "permanent", label: "Permanent (301/308)", type: "bool" }, { key: "gone", label: "Removed page (410 instead of redirect)", type: "bool" },
      { key: "note", label: "Note", wide: true },
    ],
  },
];
