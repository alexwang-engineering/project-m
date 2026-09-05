const SUBJECTS: Readonly<Record<string, string>> = {
  MA: 'Mathematics',
  EN: 'English',
  HI: 'History',
  GE: 'Geography',
  CH: 'Chemistry',
  BI: 'Biology',
  PH: 'Physics',
  FR: 'French',
  CS: 'Computer Science',
};

/** Derives presentation-only subject/year labels from a conventional school tag. */
export function labelsFromTag(tag: string): {
  subject: string;
  year: string;
} {
  const normalized = tag.toUpperCase();
  const prefix = /^(?:Y(\d{1,2})|(L6|U6))([A-Z]{2})/.exec(normalized);
  if (!prefix) return { subject: 'Other', year: 'Other' };
  const subjectCode = prefix[3]!;
  return {
    year: prefix[1]
      ? `Year ${prefix[1]}`
      : prefix[2] === 'L6'
        ? 'Lower Sixth'
        : 'Upper Sixth',
    subject: SUBJECTS[subjectCode] ?? subjectCode,
  };
}
