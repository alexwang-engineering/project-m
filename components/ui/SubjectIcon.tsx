import {
  BookOpen,
  Calculator,
  Code2,
  Dna,
  FlaskConical,
  Globe2,
  Landmark,
  Languages,
  Orbit,
  PenLine,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  Mathematics: Calculator,
  English: PenLine,
  Geography: Globe2,
  Chemistry: FlaskConical,
  Biology: Dna,
  French: Languages,
  'Computer Science': Code2,
  History: Landmark,
  Physics: Orbit,
};

export function SubjectIcon({
  subject,
  ...props
}: LucideProps & { subject: string }) {
  const Icon = icons[subject] ?? BookOpen;
  return <Icon aria-hidden="true" {...props} />;
}
