// In your Map component, ensure it's using dynamic import with ssr: false
import dynamic from 'next/dynamic';

const DynamicMap = dynamic(() => import('./DynamicMap'), {
  ssr: false,
  loading: () => <p>Loading map...</p>
});


const Map = (props) => {
  return (
      <DynamicMap {...props} />

  )
}

export default Map;