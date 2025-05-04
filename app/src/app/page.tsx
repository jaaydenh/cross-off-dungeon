import Image from 'next/image';
import Game from './game';

export const dynamic = 'force-dynamic';

export default async function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full items-center font-mono text-sm">
        <Game />
      </div>
    </main>
  );
}
