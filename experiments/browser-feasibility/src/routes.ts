export function supportsFixture(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.origin === 'http://127.0.0.1:8765' && parsed.pathname === '/feed/'
    );
  } catch {
    return false;
  }
}
