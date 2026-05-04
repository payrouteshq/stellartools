import { AuroraBackground } from "@/components/aurora-background";
import { Linkedin, XIcon } from "@/components/icon";
import { FooterSection } from "@/components/landing/footer-section";
import { Header } from "@/components/ui/navbar";
import { Github } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const team = [
  {
    name: "Emmanuel Odii",
    role: "Founder & CEO",
    bio: "Building the future of payments on Stellar. Passionate about empowering developers with seamless blockchain tools.",
    image: "/images/founder.jpeg",
    socials: {
      linkedin: "https://www.linkedin.com/in/emmanuelodii/",
      twitter: "https://x.com/devodii_",
      github: "https://github.com/devodii",
    },
  },
  {
    name: "Prince Ajuzie",
    role: "Software Engineer",
    bio: "Architecting scalable and secure decentralized infrastructure to power the next generation of commerce.",
    image: "/images/engineer.jpg",
    socials: {
      github: "https://github.com/princeajuzie7",
      linkedin: "https://www.linkedin.com/in/princeajuzie/",
      twitter: "https://x.com/princeajuzie7",
    },
  },
  {
    name: "Lucas Svoboda",
    role: "Head of Product",
    bio: "Growing the ecosystem and connecting with builders globally to bring our vision to the world.",
    image: "/images/lucas.jpeg",
    socials: { linkedin: "https://www.linkedin.com/in/lucas-s-723a73212/" },
  },
  {
    name: "Mauricio Iriarte Hermida",
    role: "Designer",
    bio: "Designing the future of payments on Stellar. Passionate about creating beautiful and intuitive user experiences.",
    image: "/images/mau.jpeg",
    socials: { linkedin: "https://www.linkedin.com/in/mauiriarte/" },
  },
];

export default function TeamPage() {
  return (
    <AuroraBackground className="min-h-screen scroll-smooth">
      <Header />
      <div className="relative z-10 h-full w-full">
        <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto mb-16 max-w-2xl space-y-4 text-center">
            <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Meet the Team
            </h1>
            <p className="text-muted-foreground text-lg">
              We are a passionate group of builders, engineers, and creatives working to make blockchain transactions
              seamless for everyone.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {team.map((member) => (
              <div
                key={member.name}
                className="bg-card text-card-foreground border-border flex flex-col items-center rounded-2xl border px-4 py-6 text-center shadow-sm transition-all hover:shadow-md"
              >
                <div className="ring-border mb-4 size-24 overflow-hidden rounded-full ring-2">
                  <Image
                    src={member.image}
                    alt={member.name}
                    width={96}
                    height={96}
                    className="size-full object-cover"
                  />
                </div>
                <h3 className="text-base font-bold tracking-tight">{member.name}</h3>
                <p className="text-muted-foreground mb-3 text-xs font-medium">{member.role}</p>
                <p className="text-muted-foreground mb-4 flex-1 text-xs leading-relaxed">{member.bio}</p>
                <div className="text-muted-foreground flex items-center gap-3">
                  {member.socials.twitter && (
                    <Link
                      href={member.socials.twitter}
                      className="hover:text-foreground transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <XIcon className="size-4" />
                    </Link>
                  )}
                  {member.socials.github && (
                    <Link
                      href={member.socials.github}
                      className="hover:text-foreground transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Github className="size-4" />
                    </Link>
                  )}
                  {member.socials.linkedin && (
                    <Link
                      href={member.socials.linkedin}
                      className="hover:text-foreground transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Linkedin className="size-4" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <h2 className="text-foreground text-2xl font-bold tracking-tight">Want to meet us?</h2>
            <p className="text-muted-foreground max-w-md text-base">
              Have a question or want to explore how StellarTools can work for you? Book a call with the team.
            </p>
            <Link
              href="/book-call"
              className="bg-primary text-primary-foreground mt-2 rounded-[9px] px-6 py-3 text-[14.5px] font-semibold no-underline transition-all hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(91,79,255,0.35)]"
            >
              Book a call →
            </Link>
          </div>
        </main>
      </div>
      <FooterSection />
    </AuroraBackground>
  );
}
