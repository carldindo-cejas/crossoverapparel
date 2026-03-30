type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="mx-auto mb-10 max-w-3xl space-y-3 text-center">
      {eyebrow ? (
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-neutral-500">{eyebrow}</p>
      ) : null}
      <h2 className="text-3xl font-semibold leading-tight text-neutral-900 md:text-4xl">{title}</h2>
      {description ? <p className="text-neutral-600">{description}</p> : null}
    </div>
  );
}
