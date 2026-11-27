import Image from "next/image";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "600"] });

/** Same "Developed by devshaarif.com" pill used on the Property Rental Manager demo. */
export default function DevCredit() {
  return (
    <a
      href="https://devshaarif.com"
      target="_blank"
      rel="noopener"
      className={`${jakarta.className} fixed right-2 bottom-2 z-30 flex items-center gap-1.5 rounded-full border-[0.8px] border-white/80 bg-white/72 py-0.5 pr-2.5 pl-0.5 text-[10px] text-[#5c6479] shadow-[0_1px_2px_0_rgba(12,19,36,0.04),0_8px_24px_-12px_rgba(12,19,36,0.1)] backdrop-blur-[16px] backdrop-saturate-150 transition-colors hover:text-[#0c1324] sm:right-4 sm:bottom-4 sm:gap-2 sm:py-1 sm:pr-3 sm:pl-1 sm:text-xs`}
    >
      <Image src="/devshaarif.png" alt="" width={24} height={24} className="size-5 rounded-full sm:size-6" />
      <span>
        Developed by <span className="font-semibold text-[#0c1324]">devshaarif.com</span>
      </span>
    </a>
  );
}
