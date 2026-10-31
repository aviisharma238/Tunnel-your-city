import './globals.css';

export const metadata = {
  title: 'Game City — 3D Traffic Simulator',
  description: 'A browser-based 3D city building and traffic management simulator',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
