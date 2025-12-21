import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CanvasList from '@/components/canvas/CanvasList';

export default async function CanvasesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: canvases, error } = await supabase
    .from('canvases')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching canvases:', error);
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-stone-900">your canvases</h1>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              sign out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <CanvasList initialCanvases={canvases || []} />
      </main>
    </div>
  );
}

