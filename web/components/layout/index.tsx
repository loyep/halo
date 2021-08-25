import React, { FC } from 'react'
import { LayoutProps } from 'ssr-types-react'
import App from './App'

const Layout: FC<LayoutProps> = (props: LayoutProps) => {
  // 注：Layout 只会在服务端被渲染，不要在此运行客户端有关逻辑
  const { injectState } = props
  const { injectCss, injectScript } = props.staticList ?? {}

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#000000" />
        <title>Serverless Side Render</title>
        {/*<script*/}
        {/*  dangerouslySetInnerHTML={{*/}
        {/*    __html:*/}
        {/*      // "var w = document.documentElement.clientWidth / 3.75;document.getElementsByTagName('html')[0].style['font-size'] = w + 'px'",*/}
        {/*}}*/}
        {/*/>*/}
        {injectCss}
      </head>
      <body className="bg-white dark:bg-black text-white dark:text-black">
        <div id="app">
          <App children={props.children} />
        </div>
        {injectState}
        {injectScript}
      </body>
    </html>
  )
}

export default Layout
