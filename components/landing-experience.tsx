"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { MnavRecord } from "@/lib/types";
import { formatCompactNumber, formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/format";

type LandingExperienceProps = {
  latest: MnavRecord | null;
  firstDate: string | null;
  eventCount: number;
};

export function LandingExperience({ latest, firstDate, eventCount }: LandingExperienceProps) {
  const shellRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const progress = Math.min(window.scrollY / Math.max(window.innerHeight * 1.8, 1), 1);
      shell.style.setProperty("--coin-rotate-x", `${22 - progress * 30}deg`);
      shell.style.setProperty("--coin-rotate-y", `${-34 + progress * 132}deg`);
      shell.style.setProperty("--coin-rotate-z", `${progress * 22}deg`);
      shell.style.setProperty("--coin-glow", `${0.46 + progress * 0.38}`);
      shell.style.setProperty("--coin-scale", `${1 - progress * 0.08}`);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main className="landing-shell landing-shell-rebuilt" ref={shellRef}>
      <div className="landing-coin-layer" aria-hidden="true">
        <div className="landing-coin-stage landing-coin-stage-fixed">
          <div className="landing-coin-halo" />
          <div className="landing-coin-shadow" />
          <div className="landing-coin">
            <div className="landing-coin-face landing-coin-face-front">
              <span>₿</span>
            </div>
            <div className="landing-coin-edge" />
            <div className="landing-coin-face landing-coin-face-back">
              <span>₿</span>
            </div>
          </div>
        </div>
      </div>

      <section className="landing-simple">
        <header className="landing-nav">
          <div>
            <p className="landing-brand">DAT.co</p>
            <p className="landing-brand-subtitle">Strategy premium monitor</p>
          </div>
          <Link className="nav-link" href="/dashboard">
            Open dashboard
          </Link>
        </header>

        <div className="landing-simple-grid">
          <section className="landing-copy-block">
            <p className="eyebrow">DAT.co mNAV Monitor</p>
            <h1>Track Strategy&apos;s Bitcoin premium in one clean view.</h1>
            <p className="landing-lede">
              A focused monitor for mNAV, BTC, MSTR, treasury NAV, and holdings changes. Built for fast scanning, not
              long explanation.
            </p>
            <div className="landing-actions-rebuilt">
              <Link className="primary-link" href="/dashboard">
                Launch workspace
              </Link>
              <a className="secondary-link" href="#landing-summary">
                Methodology
              </a>
            </div>

            <dl className="landing-tape" aria-label="Latest market summary">
              <div>
                <dt>mNAV</dt>
                <dd>{latest ? `${latest.mnav.toFixed(2)}x` : "N/A"}</dd>
              </div>
              <div>
                <dt>BTC</dt>
                <dd>{latest ? formatCurrency(latest.btcPrice) : "N/A"}</dd>
              </div>
              <div>
                <dt>MSTR</dt>
                <dd>{latest ? formatCurrency(latest.stockPrice) : "N/A"}</dd>
              </div>
              <div>
                <dt>BTC Held</dt>
                <dd>{latest ? formatCompactNumber(latest.btcHoldings) : "N/A"}</dd>
              </div>
            </dl>
          </section>

          <div className="landing-coin-column" aria-hidden="true" />
        </div>
      </section>

      <section className="landing-summary" id="landing-summary">
        <section className="landing-slab">
          <div className="slab-copy">
            <p className="section-label">Method</p>
            <h2>Fast to read. Simple to audit.</h2>
            <p>
              The app combines BTC daily closes, MSTR daily closes, and a manually curated Strategy holdings timeline.
              Version 1 uses a fixed share count.
            </p>
          </div>

          <dl className="slab-grid">
            <div>
              <dt>Coverage start</dt>
              <dd>{firstDate ? formatDate(firstDate) : "N/A"}</dd>
            </div>
            <div>
              <dt>Latest update</dt>
              <dd>{latest ? formatDate(latest.date) : "N/A"}</dd>
            </div>
            <div>
              <dt>BTC NAV</dt>
              <dd>{latest ? formatCurrencyCompact(latest.btcNav) : "N/A"}</dd>
            </div>
            <div>
              <dt>Market cap</dt>
              <dd>{latest ? formatCurrencyCompact(latest.marketCap) : "N/A"}</dd>
            </div>
          </dl>
        </section>
      </section>
    </main>
  );
}
