import Image from 'next/image';
import Room1 from './room';

export const dynamic = 'force-dynamic';

export default async function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <div className="z-10 w-full max-w-5xl items-center font-mono text-sm lg:flex">
        <Room1 />
      </div>
    </main>
  );
}
