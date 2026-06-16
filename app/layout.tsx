import "./globals.css";

export const metadata = {
  title: "Project Roadmaps — Pacific",
  description: "Single pane of glass for project progress",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
