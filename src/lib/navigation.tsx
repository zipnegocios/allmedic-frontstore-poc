'use client';

import NextLink from 'next/link';

/**
 * Drop-in replacement for react-router-dom's Link component.
 * Uses Next.js Link internally. Converts `to` prop to `href`.
 */
export function Link({
  to,
  href,
  children,
  className,
  ...props
}: {
  to?: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) {
  const finalHref = to || href || '#';
  return (
    <NextLink href={finalHref} className={className} {...props}>
      {children}
    </NextLink>
  );
}
