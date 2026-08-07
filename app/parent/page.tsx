import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createServerClient } from '@/lib/supabase/server';
import { getPupilAnnouncements, getPupilCalendar, getPupilGrades, listMyPupils } from '@/lib/content/guardians';
import { ParentView, type PupilData } from '@/components/parent/ParentView';
import type { Database } from '@/lib/database.types';

export default async function ParentPage() {
  const supabase = (await createServerClient()) as SupabaseClient<Database>;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/parent/login');

  const pupils = await listMyPupils(supabase);
  const pupilData: readonly PupilData[] = await Promise.all(
    pupils.map(async (pupil) => {
      const [calendar, announcements, grades] = await Promise.all([
        getPupilCalendar(supabase, pupil.id),
        getPupilAnnouncements(supabase, pupil.id),
        getPupilGrades(supabase, pupil.id),
      ]);
      return { pupil, calendar, announcements, grades };
    }),
  );

  return <ParentView pupilData={pupilData} />;
}
