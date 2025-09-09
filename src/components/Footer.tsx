import React from 'react';
import { Github, Heart } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="relative bg-neutral-900/85 backdrop-blur-sm py-6 border-t-[0.5px] border-neutral-800">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-neutral-400 text-sm flex items-center">
            <span>Made with</span>
            <Heart size={16} className="text-neutral-400 mx-1" />
            <span>for ton.band sessions</span>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="#" 
              className="text-neutral-400 hover:text-neutral-200 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={20} />
            </a>
            <span className="text-neutral-400 text-sm">2025</span>
          </div>
        </div>
      </div>
      {/* Gradient hairline */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[0.5px] bg-gradient-to-r from-[#4ECBD9] via-[#F471B5] to-[#4ECBD9] opacity-60" />
    </footer>
  );
};

export default Footer;