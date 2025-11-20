import './globals.css';

export const metadata = {
  title: 'Ticket Updater Dashboard',
  description: 'Manage invitations, users and downloads'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
