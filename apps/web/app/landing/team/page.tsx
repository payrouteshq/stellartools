import { FooterSection } from "@/components/footer-section";
import { Header } from "@/components/navbar";
import { Github, Linkedin, Twitter } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const team = [
  {
    name: "Emmanuel Odii",
    role: "Founder & CEO",
    image: "/images/founder.jpeg",
    socials: {
      twitter: "https://x.com/devodii_",
      github: "https://github.com/devodii",
      linkedin: "https://www.linkedin.com/in/emmanuelodii/",
    },
  },
  {
    name: "Prince Ajuzie",
    role: "Software Engineer",
    image: "/images/engineer.jpg",
    socials: {
      twitter: "https://x.com/princeajuzie7",
      github: "https://github.com/princeajuzie7",
      linkedin: "https://www.linkedin.com/in/princeajuzie/",
    },
  },
  {
    name: "Lucas Svoboda",
    role: "Head of Product",
    image: "/images/lucas.jpeg",
    socials: {
      linkedin: "https://www.linkedin.com/in/lucas-s-723a73212/",
    },
  },
  {
    name: "Mauricio Iriarte Hermida",
    role: "Designer",
    image: "/images/mau.jpeg",
    socials: {
      linkedin: "https://www.linkedin.com/in/mauiriarte/",
    },
  },
];

export default function TeamPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-24">
        <div className="mb-16 text-center">
          <p className="text-muted-foreground mb-4 text-[11px] font-semibold tracking-[1.6px] uppercase">The team</p>
          <h1 className="text-foreground text-[clamp(32px,4.5vw,52px)] font-bold tracking-tight">Who&apos;s cooking</h1>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          {team.map((member) => (
            <div key={member.name} className="flex flex-col items-center gap-3 text-center">
              <div className="size-20 overflow-hidden rounded-full">
                <Image src={member.image} alt={member.name} width={80} height={80} className="size-full object-cover" />
              </div>
              <div>
                <p className="text-foreground text-sm font-semibold">{member.name}</p>
                <p className="text-muted-foreground text-xs">{member.role}</p>
              </div>
              <div className="flex items-center gap-2.5">
                {member.socials.twitter && (
                  <Link
                    href={member.socials.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Twitter className="size-3.5" />
                  </Link>
                )}
                {member.socials.github && (
                  <Link
                    href={member.socials.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Github className="size-3.5" />
                  </Link>
                )}
                {member.socials.linkedin && (
                  <Link
                    href={member.socials.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Linkedin className="size-3.5" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      <FooterSection />
    </div>
  );
}
