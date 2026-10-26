/**
 * Renders a JSON-LD block. Every structured-data script on the site goes through
 * this so the serialisation is identical everywhere.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
