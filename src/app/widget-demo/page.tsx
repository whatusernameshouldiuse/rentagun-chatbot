import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Oswald, Open_Sans } from 'next/font/google';
import { WidgetLoader, ChatCTA } from './WidgetLoader';
import styles from './page.module.css';

// Font optimization - loaded once, subset to used characters
const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
});

const openSans = Open_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-opensans',
  display: 'swap',
});

// Types
interface Product {
  id: number;
  name: string;
  slug: string;
  price: string;
  images: { src: string; alt: string }[];
}

interface ProductsResponse {
  products: Product[];
}

// Server-side data fetching - eliminates client-side waterfall
async function getProducts(): Promise<Product[]> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const res = await fetch(`${baseUrl}/api/products?per_page=6`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!res.ok) return [];

    const data: ProductsResponse = await res.json();
    return data.products || [];
  } catch {
    return [];
  }
}

// Product card component - extracted for cleaner code
function ProductCard({ product }: { product: Product }) {
  const displayName =
    product.name.length > 50 ? product.name.substring(0, 50) + '...' : product.name;

  return (
    <article className={styles.productCard}>
      <div className={styles.productImageWrapper}>
        {product.images?.[0]?.src ? (
          <Image
            src={product.images[0].src}
            alt={product.name}
            width={280}
            height={180}
            className={styles.productImage}
            loading="lazy"
          />
        ) : (
          <span className={styles.noImage}>No image available</span>
        )}
      </div>
      <div className={styles.productInfo}>
        <h3 className={styles.productName}>{displayName}</h3>
        <p className={styles.productPrice}>
          ${product.price}
          <span>/day</span>
        </p>
        <Link
          href={`https://rentagun.com/product/${product.slug}/`}
          className={styles.viewButton}
        >
          View Details
        </Link>
      </div>
    </article>
  );
}

// Products grid with loading fallback
async function ProductsGrid() {
  const products = await getProducts();

  if (products.length === 0) {
    return <p className={styles.loading}>No products available</p>;
  }

  return (
    <div className={styles.productGrid}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

// Loading skeleton for products
function ProductsLoading() {
  return <p className={styles.loading}>Loading inventory...</p>;
}

// Main page component - Server Component by default
export default function WidgetDemo() {
  return (
    <main className={`${styles.main} ${oswald.variable} ${openSans.variable}`}>
      {/* Client-only widget loader */}
      <WidgetLoader />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="https://rentagun.com" className={styles.logo}>
            RENTAGUN
          </Link>
          <nav className={styles.nav}>
            <Link href="https://rentagun.com/shop" className={styles.navLink}>
              Browse
            </Link>
            <Link href="https://rentagun.com/how-it-works" className={styles.navLink}>
              How It Works
            </Link>
            <Link href="https://rentagun.com/pricing" className={styles.navLink}>
              Pricing
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>Find Your Perfect Rental</h1>
          <p className={styles.heroSubtitle}>
            200+ firearms ready to ship. Tell our Range Guide what you need and get matched
            with the right firearm in seconds.
          </p>
          <ChatCTA className={styles.ctaButton}>Talk to Range Guide</ChatCTA>
          <p className={styles.ctaSubtext}>Get personalized recommendations instantly</p>

          {/* Trust Badges */}
          <div className={styles.trustBadges}>
            <div className={styles.badge}>
              <span className={styles.badgeNumber}>200+</span>
              <span className={styles.badgeLabel}>Firearms</span>
            </div>
            <div className={styles.badge}>
              <span className={styles.badgeNumber}>48</span>
              <span className={styles.badgeLabel}>States</span>
            </div>
            <div className={styles.badge}>
              <span className={styles.badgeNumber}>7</span>
              <span className={styles.badgeLabel}>Day Rentals</span>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section - Server-rendered with Suspense */}
      <section className={styles.productsSection}>
        <h2 className={styles.sectionTitle}>Popular Rentals</h2>
        <Suspense fallback={<ProductsLoading />}>
          <ProductsGrid />
        </Suspense>
      </section>

      {/* Help Section */}
      <section className={styles.helpSection}>
        <h2 className={styles.helpTitle}>Not Sure What to Rent?</h2>
        <p className={styles.helpText}>
          Home defense, range day, hunting trip, or bucket list experience - tell our Range
          Guide what you&apos;re looking for and we&apos;ll match you with the perfect
          firearm.
        </p>
        <ChatCTA className={styles.secondaryButton}>Get Recommendations</ChatCTA>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.footerText}>
          &copy; 2026 Rentagun. Ships to 48 states via FFL transfer.
        </p>
      </footer>
    </main>
  );
}
