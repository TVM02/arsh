import Image from "next/image";
import {
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaXTwitter,
} from "react-icons/fa6";

export default function Footer() {
  return (
    <footer
      id="footer"
      className="relative bg-[url('/images/fbg.jpeg')] bg-cover bg-bottom text-[#f7f3e9]"
    >
      <div className="absolute inset-0 bg-[#182a1c]/[0.65]" />

      <div className="relative z-10 w-[calc(100%-4rem)] max-w-[1400px] mx-auto pt-20 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1.2fr] gap-8">
          <div className="md:border-r md:border-[#d8bf78]/20 md:pr-8">
            <div className="mb-4">
              <Image
                src="/images/logo2.png"
                alt="DKJU"
                width={80}
                height={80}
              />
            </div>

            <h2 className="text-[2rem] mb-6 font-normal font-serif">
              Dakshina Kerala Jem-Iyyathul Ulama
            </h2>

            <p className="text-[#d9d4c5] mb-6">
              Smart Islamic Education Platform
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href="#"
                className="flex items-center justify-center border border-[#d8bf78]/50 rounded-full text-[#d8bf78] transition-all duration-300 w-[28px] h-[28px] hover:bg-[#d8bf78]/[0.15]"
              >
                {" "}
                <FaFacebookF />{" "}
              </a>
              <a
                href="#"
                className="flex items-center justify-center border border-[#d8bf78]/50 rounded-full text-[#d8bf78] transition-all duration-300 w-[28px] h-[28px] hover:bg-[#d8bf78]/[0.15]"
              >
                {" "}
                <FaXTwitter />{" "}
              </a>
              <a
                href="#"
                className="flex items-center justify-center border border-[#d8bf78]/50 rounded-full text-[#d8bf78] transition-all duration-300 w-[28px] h-[28px] hover:bg-[#d8bf78]/[0.15]"
              >
                {" "}
                <FaInstagram />
              </a>
              <a
                href="#"
                className="flex items-center justify-center border border-[#d8bf78]/50 rounded-full text-[#d8bf78] transition-all duration-300 w-[28px] h-[28px] hover:bg-[#d8bf78]/[0.15]"
              >
                {" "}
                <FaYoutube />{" "}
              </a>
            </div>
          </div>

          <div className="md:border-r md:border-[#d8bf78]/20 md:pr-8">
            <h3 className="mb-6 text-[#d8bf78] text-[1.5rem] font-normal font-serif">
              Quick Links
            </h3>

            <ul className="list-none p-0 m-0">
              <li className="mb-[0.9rem] text-[#f3f0e7] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#d8bf78] rounded-full"></span>
                <a href="/#home" className="hover:text-[#d8bf78] transition-colors">Home</a>
              </li>
              <li className="mb-[0.9rem] text-[#f3f0e7] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#d8bf78] rounded-full"></span>
                <a href="/#about" className="hover:text-[#d8bf78] transition-colors">About</a>
              </li>
              <li className="mb-[0.9rem] text-[#f3f0e7] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#d8bf78] rounded-full"></span>
                <a href="/#updates" className="hover:text-[#d8bf78] transition-colors">News</a>
              </li>
              <li className="mb-[0.9rem] text-[#f3f0e7] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#d8bf78] rounded-full"></span>
                <a href="/#events" className="hover:text-[#d8bf78] transition-colors">Events</a>
              </li>
              <li className="mb-[0.9rem] text-[#f3f0e7] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#d8bf78] rounded-full"></span>
                <a href="/#mushawara" className="hover:text-[#d8bf78] transition-colors">Leaders</a>
              </li>
            </ul>
          </div>

          <div className="md:border-r md:border-[#d8bf78]/20 md:pr-8">
            <h3 className="mb-6 text-[#d8bf78] text-[1.5rem] font-normal font-serif">
              Resources
            </h3>

            <ul className="list-none p-0 m-0">
              <li className="mb-[0.9rem] text-[#f3f0e7] flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#d8bf78] rounded-full"></span>
                <a href="/brand-guide" className="hover:text-[#d8bf78] transition-colors">Brand Style Guide</a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-6 text-[#d8bf78] text-[1.5rem] font-normal font-serif">
              Address
            </h3>

            <p className="mb-4">
              Dakshina Kerala Jem-Iyyathul Ulama (DKJU)
            </p>

            <p>Jonakappuram, Pallithottam, P. O, Kollam - 691006</p>
          </div>
        </div>

        <div className="mt-16 pt-6 text-[#d9d4c5] border-t border-[#d8bf78]/20 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 DKIMVB IT Division. All rights reserved.</p>
          <div className="flex gap-6 text-sm">
            <a href="/privacy-policy" className="hover:text-[#d8bf78] transition-colors">Privacy Policy</a>
            <a href="/terms-and-conditions" className="hover:text-[#d8bf78] transition-colors">Terms & Conditions</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
