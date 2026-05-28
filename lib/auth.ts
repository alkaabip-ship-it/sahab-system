// @ts-nocheck
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'البريد الإلكتروني', type: 'email' },
        password: { label: 'كلمة المرور', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          console.log('[AUTH] Missing credentials')
          return null
        }

        // Support login by username (name field) OR email (case-insensitive)
        const emailLower = credentials.email.toLowerCase().trim()
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: emailLower, mode: 'insensitive' } },
              { name:  { equals: credentials.email.trim(), mode: 'insensitive' } },
            ],
          },
        })

        if (!user) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        // Record login (fire and forget — never block the login flow)
        const ip =
          (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
          (req?.headers?.['x-real-ip'] as string) ||
          null
        const userAgent = (req?.headers?.['user-agent'] as string) || null
        prisma.loginLog.create({ data: { userId: user.id, ip, userAgent } }).catch(() => {})

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        (session.user as any).role = token.role
        ;(session.user as any).id = token.id
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
