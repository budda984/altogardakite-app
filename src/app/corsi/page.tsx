import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { GraduationCap } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { COURSE_LABELS, type CourseType } from '@/lib/types';

export default async function CoursesPage() {
  const supabase = await createClient();
  const { data: courses } = await supabase
    .from('courses')
    .select(`*, member:members(id, first_name, last_name, membership_number)`)
    .order('start_date', { ascending: false });

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-widest text-text-dim mb-2">Formazione</div>
        <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tightest">
          Corsi
        </h1>
        <p className="mt-2 text-text-muted text-sm">
          {courses?.length ?? 0} corsi totali
        </p>
      </header>

      {(!courses || courses.length === 0) && (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <GraduationCap className="h-8 w-8 text-text-dim mx-auto mb-3" />
          <div className="text-text-muted text-sm">Nessun corso ancora registrato.</div>
        </div>
      )}

      {courses && courses.length > 0 && (
        <div className="rounded-lg border border-border bg-bg-surface overflow-hidden">
          <div className="divide-y divide-border">
            {courses.map((c: any) => (
              <Link
                key={c.id}
                href={`/soci/${c.member.id}`}
                className="block px-5 py-4 hover:bg-bg-elevated transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">
                      {COURSE_LABELS[c.course_type as CourseType]}
                    </div>
                    <div className="text-sm text-text-muted mt-0.5">
                      {c.member.first_name} {c.member.last_name}
                      <span className="text-text-dim"> • #{c.member.membership_number}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">
                      {c.hours_completed}/{c.hours_total}h
                    </div>
                    <div className="text-xs text-text-muted">
                      {formatDate(c.start_date)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{
                      width: `${Math.min(100, (c.hours_completed / Math.max(c.hours_total, 1)) * 100)}%`,
                    }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
