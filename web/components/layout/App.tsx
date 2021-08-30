import '@/global.css'
import { LayoutProps } from 'ssr-types-react'
import React, { FC, useEffect } from 'react'
import Container from '@/components/Container'
import { Button } from 'antd'
import useTheme from '@/hooks/theme'
import { useLocation } from 'react-router-dom'
import axios from 'axios'

const App: FC<LayoutProps> = (props: LayoutProps) => {
  const [, toggleTheme] = useTheme()
  const location = useLocation()

  useEffect(() => {
    axios.post(`/api/log`, {})
  }, [location])

  return (
    <Container>
      {props.children}
      <Button className="bg-gray-300 text-white dark:text-white dark:bg-black rounded w-28" onClick={toggleTheme}>
        Theme
      </Button>
    </Container>
  )
}

export default App
