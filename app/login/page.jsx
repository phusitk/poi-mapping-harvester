export default async function LoginPage({ searchParams }) {
  const params = await searchParams
  const hasError = Boolean(params?.error)

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — branding ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[30%] flex-col justify-between
                      bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900
                      p-12 relative overflow-hidden">

        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full
                        bg-blue-500 opacity-10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] rounded-full
                        bg-indigo-500 opacity-10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-64 h-64 rounded-full bg-blue-400 opacity-5 blur-2xl pointer-events-none" />

        {/* Logo / brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">POI Platform</span>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-snug">
            PK Research-Tool<br />
            <span className="text-blue-400">POI harvesting</span><br />
            at your fingertips.
          </h2>
          <p className="mt-4 text-slate-400 text-sm leading-relaxed max-w-xs">
            Map, harvest, and manage points of interest across geographic areas with precision and speed.
          </p>

          {/* Feature pills */}
          <div className="mt-8 flex flex-wrap gap-2">
            {['Google Maps API', 'Grid selection', 'Job history', 'CSV export'].map((f) => (
              <span key={f}
                className="px-3 py-1 rounded-full text-xs font-medium
                           bg-white/10 text-slate-300 border border-white/10">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p className="relative z-10 text-xs text-slate-600">
          Internal research tool — authorised users only.
        </p>
      </div>

      {/* ── Right panel — form ────────────────────────────────── */}
      <div className="lg:w-[70%] flex flex-col items-center justify-center
                      bg-white px-6 py-12 sm:px-12">

        {/* Mobile brand (shown only on small screens) */}
        <div className="mb-8 text-center lg:hidden">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl
                          bg-blue-600 shadow-lg mb-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-800">POI Mapping Platform</p>
        </div>

        <div className="w-full max-w-sm">

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="mt-1 text-sm text-gray-500">Sign in to your account to continue.</p>
          </div>

          {/* Error alert */}
          {hasError && (
            <div className="mb-5 flex items-start gap-3 rounded-xl bg-red-50
                            border border-red-200 px-4 py-3">
              <svg className="mt-0.5 w-4 h-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-700">Invalid username or password. Please try again.</p>
            </div>
          )}

          {/* Form */}
          <form method="POST" action="/api/auth/login" className="space-y-5">

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5
                             text-sm text-gray-900 placeholder-gray-400 transition
                             focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2
                             focus:ring-blue-500/20"
                  placeholder="your_username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5
                             text-sm text-gray-900 placeholder-gray-400 transition
                             focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2
                             focus:ring-blue-500/20"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold
                         text-white shadow-sm hover:bg-blue-700 active:bg-blue-800
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                         transition-colors duration-150"
            >
              Sign in
            </button>

          </form>

        </div>

        {/* Bottom note */}
        <p className="mt-12 text-xs text-gray-400">
          Authorised access only. All activity is logged.
        </p>
      </div>

    </div>
  )
}
