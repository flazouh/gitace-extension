import { mount } from "./mount"
import { Footer, Masthead } from "./Shell"
import "./index.css"

/*
 * `/privacy`: the policy stays plain HTML, so it reads with scripts off. Only the bar,
 * the nav and the footer every page shares are mounted around it.
 */
mount("masthead", <Masthead />)
mount("footer", <Footer />)
