// import React from 'react'
// import HeroSection from './HeroSection'
// import CategorySlider from './CategorySlider'
// import connectDb from '@/lib/db'
// import Grocery, { IGrocery } from '@/models/grocery.model'
// import GroceryItemCard from './GroceryItemCard'

// async function UserDashboard({groceryList}:{groceryList:IGrocery[]}) {
// await connectDb()
// const plainGrocery = JSON.parse(JSON.stringify(groceryList))

//   return (
//     <>
//       <HeroSection/>
//       <CategorySlider/>
//       <div className='w-[90%] md:w-[80%] mx-auto mt-10'>
//         <h2 className='text-2xl md:text-3xl font-bold text-green-700 mb-6 text-center'>Popular Grocery Items</h2>
//         <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6'> 
//           {plainGrocery.map((item:any,index:number)=>(
//         <GroceryItemCard key={index} item={item}/>
//       ))}
//       </div>

//       </div>
     
//     </>
//   )
// }

// export default UserDashboard
'use client'

import React, { useState, useEffect } from 'react'
import HeroSection from './HeroSection'
import CategorySlider from './CategorySlider'
import GroceryItemCard from './GroceryItemCard'

type Props = {
  groceryList: any[]
}

function UserDashboard({ groceryList }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [filteredProducts, setFilteredProducts] = useState<any[]>(groceryList)

  useEffect(() => {
    if (selectedCategory) {
      const filtered = groceryList.filter(
        (item) =>
          item.category?.trim().toLowerCase() ===
          selectedCategory.trim().toLowerCase()
      )
      setFilteredProducts(filtered)
    } else {
      setFilteredProducts(groceryList)
    }
  }, [selectedCategory, groceryList])

  return (
    <>
      <HeroSection />

      <CategorySlider
        setSelectedCategory={setSelectedCategory}
        selectedCategory={selectedCategory}
      />

      <div className='w-[90%] md:w-[80%] mx-auto mt-10'>
        <h2 className='text-2xl md:text-3xl font-bold text-green-700 mb-6 text-center'>
          {selectedCategory ? selectedCategory : "Popular Grocery Items"}
        </h2>

        {selectedCategory && (
          <div className="text-center mb-4">
            <button
              onClick={() => setSelectedCategory(null)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg"
            >
              Show All
            </button>
          </div>
        )}

        <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6'>
          {filteredProducts.map((item, index) => (
            <GroceryItemCard key={index} item={item} />
          ))}
        </div>
      </div>
    </>
  )
}

export default UserDashboard