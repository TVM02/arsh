// Sample mahals data
// This can be used to seed the mahals collection in Firestore

export const sampleMahals = [
  {
    id: 'mahal001',
    name: 'Al-Hidayah Mahal',
    location: 'Mumbai, Maharashtra',
    established: '2010',
    status: 'active'
  },
  {
    id: 'mahal002', 
    name: 'Noor-e-Islam Mahal',
    location: 'Delhi, Delhi',
    established: '2012',
    status: 'active'
  },
  {
    id: 'mahal003',
    name: 'Jamia Islamia Mahal', 
    location: 'Kolkata, West Bengal',
    established: '2008',
    status: 'active'
  },
  {
    id: 'mahal004',
    name: 'Madrasa Al-Falah',
    location: 'Hyderabad, Telangana', 
    established: '2015',
    status: 'active'
  },
  {
    id: 'mahal005',
    name: 'Darul Uloom Mahal',
    location: 'Lucknow, Uttar Pradesh',
    established: '2005',
    status: 'active'
  }
];

// Function to seed mahals into Firestore (run this once to populate data)
export async function seedMahals() {
  const { db } = await import('@/lib/firebase');
  const { doc, setDoc } = await import('firebase/firestore');
  
  try {
    for (const mahal of sampleMahals) {
      await setDoc(doc(db, 'mahals', mahal.id), {
        ...mahal,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    console.log('Mahals seeded successfully');
  } catch (error) {
    console.error('Error seeding mahals:', error);
  }
}
