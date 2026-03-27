export const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET,
  cookieName: 'poi.session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60, // 8 hours
  },
}
