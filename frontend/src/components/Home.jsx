import React from 'react'
import { useState } from 'react'

const Home = () => {
    const [tabIdx,setTabIdx] = useState(0);
  return (
    <div className='flex flex-row w-full h-full bg-red-400'>
      <div>

      </div>
      <div className='flex flex-col p-2'>
        <div className='flex flex-col'>
            <div className='flex'>
                <button className='uppercase' onClick={() => setTabIdx(0)}>login</button>
                <button className='uppercase' onClick={() => setTabIdx(1)}>register</button>
            </div>
            {
                (tabIdx == 0 ? 
                <div className='flex flex-col'>
                    <h3 className='uppercase'>email</h3>
                    <input type="email"/>
                </div> : 
                <div className='flex flex-col'>

                </div>)
            }
        </div>
      </div>
    </div>
  )
}

export default Home
