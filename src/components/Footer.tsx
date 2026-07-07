import Image from "next/image";

import githubIcon from "@/assets/icons/github.svg";
import twitterIcon from "@/assets/icons/twitter.svg";
import websiteIcon from "@/assets/icons/website.svg";

import app from "../../package.json";

export const Footer = () => {
  return (
    <div className="mt-10 flex items-center justify-center text-sm text-brand-500">
      <div>
        <div className="mb-2 text-center">for Aave DAO</div>
        <div className="flex justify-center gap-1">
          <a href="https://twitter.com/aave" target="_blank" rel="noreferrer">
            <Image src={twitterIcon} className="h-6 w-6" alt="Aave Twitter" />
          </a>
          <a
            href="https://github.com/aave-dao/adi-dashboard"
            target="_blank"
            rel="noreferrer"
          >
            <Image src={githubIcon} className="h-6 w-6" alt="Aave DAO GitHub" />
          </a>
          <a href="https://aave.com/" target="_blank" rel="noreferrer">
            <Image src={websiteIcon} className="h-6 w-6" alt="Aave Website" />
          </a>
        </div>
        <div className="mt-4 text-center font-mono text-brand-500 opacity-60">
          {app.version}
        </div>
      </div>
    </div>
  );
};
