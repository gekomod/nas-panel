export const getSystemStats = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/system')
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching system stats:', error)
    // Return mock data if API fails
    return {
      cpu: Math.floor(Math.random() * 30) + 10,  // Random between 10-40%
      totalMem: 8 * 1024 * 1024 * 1024,         // 8GB
      usedMem: Math.floor(Math.random() * 6 * 1024 * 1024 * 1024)  // Random 0-6GB
    }
  }
}
