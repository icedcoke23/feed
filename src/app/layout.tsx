import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/auth-context';
import { RouteGuard } from '@/components/auth/route-guard';
import { ErrorBoundary } from '@/components/error-boundary';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '教学反馈系统',
    template: '%s | 教学反馈系统',
  },
  description:
    '教学反馈管理系统，用于记录学员课堂表现、能力评价和教学反馈，帮助教师和家长全面了解学员学习进展。',
  keywords: [
    '教学反馈',
    '学员管理',
    '能力评价',
    '课堂反馈',
    '教学管理',
    '教育培训',
    '编程教育',
  ],
  authors: [{ name: 'Teaching Feedback Team' }],
  openGraph: {
    title: '教学反馈系统',
    description:
      '记录学员课堂表现与能力评价，助力教学反馈与成长追踪。',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        <AuthProvider>
          {isDev && <Inspector />}
          <ErrorBoundary>
            <RouteGuard>
              {children}
            </RouteGuard>
          </ErrorBoundary>
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </body>
    </html>
  );
}
