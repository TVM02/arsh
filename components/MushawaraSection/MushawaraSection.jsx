"use client";
import Image from "next/image";
import { leaders } from "@/data/mushawara";

export default function MushawaraSection() {
  return (
<section id="mushawara" className="w-full bg-white py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">

        {/* Section Header */}
        <div className="mb-12 text-center">
          <h2
            className="
              text-3xl
              font-serif
              tracking-tight
              text-[#075c3f]
              sm:text-4xl
              md:text-5xl
              font-normal
            "
          >
            MEET OUR MUSHAWARA
          </h2>

          <p
            className="
              mt-3
              text-sm
              text-gray-700
              sm:text-base
              md:text-lg
              
            "
          >
            Dedicated professionals driving global innovation and excellence.
          </p>
        </div>

        {/* Team Grid */}
       <div
  className="
    grid
    grid-cols-1
    sm:grid-cols-2
    lg:grid-cols-6
    gap-8
    max-w-[1250px]
    mx-auto
    justify-items-center
  "
>
  {leaders.map((member, index) => (
    <div
      key={member.name}
      className={`
        group
        relative
        w-72
        min-h-[390px]
        overflow-hidden
        rounded-3xl
        bg-white
        text-center
        shadow-[0_10px_30px_rgba(0,0,0,0.10)]
        transition-all
        duration-500
        hover:-translate-y-3
        hover:shadow-[0_20px_45px_rgba(0,90,60,0.22)]

        ${
          index < 3
            ? "lg:col-span-2"
            : index === 3
            ? "lg:col-start-2 lg:col-span-2"
            : "lg:col-start-4 lg:col-span-2"
        }
      `}
    >

      {/* Card Content */}
      <div className="relative z-10 flex h-full flex-col items-center px-7 py-8">

        {/* Profile Image */}
        <div className="mb-7 flex justify-center">
          <div
            className="
              relative
              h-48
              w-48
              overflow-hidden
              rounded-full
              border-[3px]
              border-white
              bg-gray-100
              p-[5px]
              shadow-[0_8px_25px_rgba(0,0,0,0.18)]
              transition-all
              duration-500
              group-hover:scale-105
              group-hover:border-emerald-600
              group-hover:shadow-[0_10px_30px_rgba(5,150,105,0.35)]
            "
          >
            <div
              className="
                relative
                h-full
                w-full
                overflow-hidden
                rounded-full
                bg-[url('/images/bg.jpeg')]
                bg-cover
                bg-center
              "
            >
              <Image
                src={member.image}
                alt={member.name}
                fill
                sizes="192px"
                className="
                  object-cover
                  transition-transform
                  duration-700
                  group-hover:scale-105
                "
              />
            </div>
          </div>
        </div>

        {/* Name */}
        <h3
          className="
            text-lg
            font-serif
            font-normal
            leading-tight
            text-gray-800
            transition-colors
            duration-300
            group-hover:text-emerald-800
          "
        >
          {member.name}
        </h3>

        {/* Role */}
        <p
          className="
            mt-3
            text-base
            font-medium
            text-gray-500
            transition-colors
            duration-300
            group-hover:text-emerald-700
          "
        >
          {member.role}
        </p>

        {/* Green bottom line */}
        <div
          className="
            mt-5
            h-1
            w-0
            rounded-full
            bg-emerald-600
            transition-all
            duration-500
            group-hover:w-16
          "
        />

      </div>
    </div>
  ))}
</div>
      </div>
    </section>

    // <section id="mushawara" className="py-12">
    //   <div className="relative z-10 w-[calc(100%-4rem)] max-w-[1400px] mx-auto">
    //     <h2 className="text-center text-[2.8rem] mb-12 font-serif text-[#274629] font-normal">
    //       Meet Our Mushawara
    //     </h2>

    //     <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6">
    //       {leaders.map((leader) => (
    //         <div
    //           key={leader.id}
    //           className="relative bg-white rounded overflow-hidden backdrop-blur-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-[#c9b37e]/45 p-[0.4rem] before:absolute before:inset-[6px] before:border before:border-[#c9b37e]/25 before:rounded before:pointer-events-none z-10"
    //         >
    //           <div className="relative w-full aspect-square bg-[url('/images/bg.jpeg')] bg-cover bg-center border-2 border-[#c9b37e] [clip-path:polygon(0%_100%,0%_18%,6%_18%,6%_8%,22%_0%,78%_0%,94%_8%,94%_18%,100%_18%,100%_100%)]">
    //             <Image
    //               src={leader.image}
    //               alt={leader.name}
    //               fill
    //               sizes="100vw"
    //               className="object-cover"
    //             />
    //           </div>

    //           <div className="p-4 text-center text-[#274629] bg-white border-t border-[#c9b37e]">
    //             <h3 className="text-[15px] mb-2 font-normal">{leader.name}</h3>
    //             <div className="h-[1px] bg-gradient-to-r from-transparent via-[#c9b37e]/50 to-transparent my-[0.8rem] w-full"></div>
    //             <p className="text-[#666] text-[0.8rem] m-0">{leader.role}</p>
    //           </div>
    //         </div>
    //       ))}
    //     </div>
    //   </div>
    // </section>
  );
}
