import NewsList from "./NewsList";
import FeaturedEventSlider from "./FeaturedNews";
import DkjuNewsList from "./Dkjunews";
export default function UpdatesSection() {
  return (
    <section id="updates" className="py-12">
      <div className="relative z-10 w-[calc(100%-4rem)] max-w-[1400px] mx-auto">
        <h2 className="text-center text-[#274629] font-serif text-[clamp(2.25rem,4vw,3rem)] font-normal mb-10">
          Latest Updates
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-[0.5fr_0.8fr_0.5fr] gap-6">
          <NewsList />
         <FeaturedEventSlider />
          <DkjuNewsList />
          
        </div>
      </div>
    </section>
  );
}
