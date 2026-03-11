import PageLayout from '../../components/PageLayout'
import { AlphaThresholdPage } from './components/AlphaThresholdPage'

export default function AlphaThresholdToolPage() {
  return (
    <PageLayout
      title="Alpha vs Threshold"
      summary="Compare weapon alpha against ship ballistic or energy thresholds to see which ships can take hull damage."
    >
      <AlphaThresholdPage />
    </PageLayout>
  )
}
