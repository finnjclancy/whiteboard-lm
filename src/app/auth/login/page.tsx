'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/canvases');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-stone-900 mb-2">
              welcome back
            </h1>
            <p className="text-stone-500 text-sm">
              sign in to continue to your canvases
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-stone-700 mb-1.5"
              >
                email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:border-stone-500 focus:ring-2 focus:ring-stone-200 outline-none transition-all text-stone-900 placeholder:text-stone-400"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-stone-700 mb-1.5"
              >
                password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:border-stone-500 focus:ring-2 focus:ring-stone-200 outline-none transition-all text-stone-900 placeholder:text-stone-400"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'signing in...' : 'sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-500">
            don&apos;t have an account?{' '}
            <Link
              href="/auth/signup"
              className="text-stone-900 font-medium hover:underline"
            >
              sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

