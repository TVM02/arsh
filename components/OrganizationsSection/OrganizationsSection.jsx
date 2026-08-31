import Image from "next/image";
import { organizations } from "@/data/organizations";

export default function OrganizationsSection() {
  return (

<section className="py-20 bg-gradient-to-b from-white to-gray-50">
  <div className="max-w-7xl mx-auto px-6">

    {/* Section Header */}
    <div className="text-center mb-14">
      <span className="inline-block px-4 py-1.5 mb-4 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold tracking-wide">
        OUR NETWORK
      </span>

      <h2 className="text-4xl md:text-5xl font-serif font-semibold text-gray-900">
        Associated Organizations
      </h2>

      <div className="w-20 h-1 bg-emerald-600 mx-auto mt-5 rounded-full" />

      <p className="mt-5 max-w-2xl mx-auto text-gray-500 text-base md:text-lg">
        Organizations working together to strengthen Islamic education,
        cultural development and community services.
      </p>
    </div>

   
    {/* Organizations Grid */}
<div className="flex flex-wrap justify-center gap-6">

  {organizations.map((org) => (
    <div key={org.id}
      className="
        group relative
        bg-white
        rounded-2xl
        border border-gray-100
        p-5
        text-center
        shadow-sm
        hover:shadow-xl
        hover:-translate-y-2
        transition-all duration-300
        overflow-hidden

        w-full
        sm:w-[calc(50%-12px)]
        lg:w-[calc(25%-18px)]
      "
    >

      {/* Top Accent */}
      <div
        className="
          absolute top-0 left-0 right-0
          h-1
          bg-gradient-to-r
          from-emerald-500
          via-green-600
          to-emerald-700
          scale-x-0
          group-hover:scale-x-100
          transition-transform duration-300
          origin-left
        "
      />

      {/* Logo */}
      <div
        className="
          mx-auto
          w-32 h-32
          rounded-2xl
          bg-gray-50
          border border-gray-100
          flex items-center justify-center
          overflow-hidden
          group-hover:bg-emerald-50
          transition-colors duration-300
        "
      >
        <img
          src={org.logo}
          alt={org.name}
          className="
            w-full
            h-full
            object-contain
            p-3
            group-hover:scale-110
            transition-transform duration-500
          "
        />
      </div>

      {/* Short Name */}
      <div className="mt-5">
        <span
          className="
            inline-flex
            px-3 py-1
            rounded-full
            bg-emerald-50
            text-emerald-700
            text-sm
            font-bold
            tracking-wide
          "
        >
          {org.short}
        </span>
      </div>

      {/* Organization Name */}
      <h3
        className="
          mt-4
          text-base
          font-semibold
          text-gray-800
          leading-6
          group-hover:text-emerald-700
          transition-colors
        "
      >
        {org.name}
      </h3>

      {/* Bottom Arrow */}
      <div
        className="
          mt-5
          text-emerald-600
          text-sm
          font-medium
          opacity-0
          translate-y-2
          group-hover:opacity-100
          group-hover:translate-y-0
          transition-all duration-300
        "
      >
        Learn more →
      </div>

    </div>
  ))}

</div>
  </div>
</section>

    
  );
}
