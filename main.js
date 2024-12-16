// @ts-check
"use-strict";
import queryString from 'query-string';
import { JSDOM } from "jsdom";
import moment from 'moment';
import { writeFileSync } from 'fs';
import 'dotenv/config';

function requiredEnv(name)
{
    const value = process.env[name];
    if (value === undefined)
    {
        throw new Error(`The environment variable ${name} is required`);
    }
    return value;
}


const baseUrl = "http://crd.usm.md";
const loginUrl = `${baseUrl}/studregistry/account/login`;
const credentials = {
    UserLogin: requiredEnv("LOGIN"),
    UserPassword: requiredEnv("PASSWORD"),
};

const sessionIdCookieName = "ASPSESSIONIDSAQSQQCS";
const tokenCookieName = "ForDecanat";

const unparsedTopics = `06.09.2024 curs   Развитие языка С++: стандарты, компиляторы, среда разработки
13.09.2024 curs   Основы языка / типы данных
20.09.2024 curs   Основы языка / базовые конструкции
27.09.2024 curs   Проект. Системы сборки проектов.
04.10.2024 curs   Пользовательские типы данных
11.10.2024 curs   Объектно-Ориентированное Программирование
18.10.2024 curs   Перегрузка операций
25.10.2024 curs   Метапрограммирование
01.11.2024 curs   Стандартная библиотека С++: Контейнеры и итераторы
22.11.2024 curs   Стандартная библиотека С++: Алгоритмы
06.09.2024 laborator   ЛР №1: Создание проекта. Работа с GIT
13.09.2024 laborator   ЛР №1: Создание проекта. Работа с GIT
14.09.2024 laborator   ЛР №1: Создание проекта. Работа с GIT
20.09.2024 laborator   ЛР №2: Создание и использование классов. Многофайловые проекты. Сборка проекта.
27.09.2024 laborator   ЛР №2: Создание и использование классов. Многофайловые проекты. Сборка проекта.
28.09.2024 laborator   ЛР №2: Создание и использование классов. Многофайловые проекты. Сборка проекта.
04.10.2024 laborator   ЛР №3: Конструкторы и операторы
11.10.2024 laborator   ЛР №3: Конструкторы и операторы
12.10.2024 laborator   ЛР №3: Конструкторы и операторы
18.10.2024 laborator   ЛР №3: Конструкторы и операторы`;

{
    const topics = parseTopics(unparsedTopics);
    const token = await logIn();
    
    const requiredData = { token: token };
    const groupLinksResult = await getAllGroupLinks("27114", requiredData);
    requiredData.antiforgeryToken = groupLinksResult.antiforgeryToken;
    
    for (const link of groupLinksResult.lessonListUrls) {
        await editTopicsInGroup(link, requiredData, topics);
    }
}

function doError(result)
{
    throw new Error(`HTTP error! status: ${result.status} ${result.statusText}`);
}

function parseTopics(unparsedTopics)
{
    let ret = unparsedTopics.split("\n").map(line => {
        const leftRight = line.split("   ");
        const dateAndType = leftRight[0].split(" ");
        const date = moment(dateAndType[0], "DD.MM.YYYY").toDate();
        const type = dateAndType[1];
        const name = leftRight[1];
        return {
            date,
            type,
            name
        };
    });
    // sort by date
    ret = ret.sort((a, b) => a.date - b.date);
    return ret;
}

/**
 * @param {{ token?: any; sessionId?: any; antiforgeryToken?: any; }} requiredData
 */
function getHeaders(requiredData)
{
    const cookies = [];
    if (requiredData.token)
    {
        cookies.push(`${tokenCookieName}=${requiredData.token}`);
    }
    if (requiredData.sessionId)
    {
        cookies.push(`${sessionIdCookieName}=${requiredData.sessionId}`);
    }
    if (requiredData.antiforgeryToken)
    {
        const t = requiredData.antiforgeryToken;
        cookies.push(`${t.name}=${t.value}`);
    }
 
    const ret = {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "sec-gpc": "1",
        "upgrade-insecure-requests": "1",
        "Referer": loginUrl,
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    };

    if (cookies.length > 0)
    {
        ret["cookie"] = cookies.join("; ");
    }

    return ret;
}

function parseCookies(cookies)
{
    const ret = {};
    for (const cookie of cookies.split(";"))
    {
        const [name, value] = cookie.split("=");
        ret[name] = value;
    }
    return ret;
}

async function logIn()
{
    const formData = new URLSearchParams();
    for (const key in credentials)
    {
        formData.set(key, credentials[key]);
    }

    const url = loginUrl + "?" + queryString.stringify(credentials);
    let response = await fetch(url,
    {
        method: "POST",
        headers: getHeaders({}),
        redirect: "manual",
    })
    if (response.status !== 302)
    {
        doError(response);
    }
    const headers = response.headers;
    const cookies = headers.get("Set-Cookie");
    if (cookies === null)
    {
        throw new Error("No cookies in response");
    }
    const token = parseCookies(cookies)[tokenCookieName];

    return token;
}

/**
 * @param {string} courseId
 * @param {{ token: any; }} requiredHeaders
 */
async function getAllGroupLinks(courseId, requiredHeaders)
{
    const allGroupsUrl = `${baseUrl}/studregistry/LessonAttendance/groups/${courseId}`;

    const result = await fetch(allGroupsUrl,
    {
        "headers": getHeaders(requiredHeaders),
        "method": "GET",
    });

    if (!result.ok)
    {
        doError(result);
    }

/* <form method="post" name="lesson">
        

            <hr>
            <div class="row">
                <h4 class="col">Evidența frecvenței si reușitei</h4>
            
            </div>
            <div class="row">

                <div class="col">
                    <div class="row">

                        <a class="col-4" href="/studregistry/LessonAttendance/LessonsList/27114?groupId=24480">
                            DJ2302ru
                        </a>
                        <span class="col-2">Zi a.2</span>
                        
                        <a class="col-2" href="/studregistry/Evaluation/Index/27114?groupId=24480">
                            Evaluare
                        </a>
                        <span class="col-4">Designul jocurilor</span>
                    </div>
                    <div class="row">

                        <a class="col-4" href="/studregistry/LessonAttendance/LessonsList/27114?groupId=24668">
                            DJ2303ru(II)
                        </a>
                        <span class="col-2">Zi a.2</span>
                        
                        <a class="col-2" href="/studregistry/Evaluation/Index/27114?groupId=24668">
                            Evaluare
                        </a>
                        <span class="col-4">Designul jocurilor</span>
                    </div>
                </div>
            </div>
    <input name="__RequestVerificationToken" type="hidden" value="CfDJ8IIiqZWn_-FNrKQC5B88ss6vuM1PHZZIew2Sd1BuOVf2ZLvpySzsC91v7p-58SangBVDtHTqTdduGQWyvuLa56Ecd2gXIaNfSvBAI97gxf-J5p-Soa2Sl5GTKfZwmum67WgUhApGDAhm_FF97ZbF3ADvVeIUq5kTVj2shkLfoeGzktrkLWyB7F4lsqbZQL7mbQ"></form> */

    const lessonListUrls = await (async function()
    {
        const htmlText = await result.text();
        const dom = new JSDOM(htmlText);
        const form = dom.window.document.querySelector("form[name=lesson]");
        // const verificationToken = form.querySelector("input[name=__RequestVerificationToken]").getAttribute("value");
        const links = form.querySelectorAll("a");
        
        const ret = [];
        for (const link of links)
        {
            const href = link.getAttribute("href");
            const url = new URL(href, baseUrl);
            if (!url.pathname.includes("/LessonsList/"))
            {
                continue;
            }
            ret.push(url);
        }
        return ret;
    }());

    const antiforgeryToken = (function()
    {
        const cookiesHeader = result.headers.get("Set-Cookie");
        const cookies = parseCookies(cookiesHeader);

        for (const key in cookies)
        {
            if (key.startsWith(".AspNetCore.Antiforgery."))
            {
                return { name: key, value: cookies[key] };
            }
        }
        throw new Error("No antiforgery token found");
    })();

    return { lessonListUrls, antiforgeryToken };
}

/**
 * @param {string | URL | Request} groupLink
 * @param {{ token: any; }} requiredHeaders
 * @param {string | any[]} topics
 */
async function editTopicsInGroup(groupLink, requiredHeaders, topics)
{
    const result = await fetch(groupLink,
    {
        "headers": getHeaders(requiredHeaders),
        "method": "GET",
    });

    if (!result.ok)
    {
        doError(result);
    }

    const htmlText = await result.text();
    writeFileSync("group.html", htmlText);
    const dom = new JSDOM(htmlText);
    const links = dom.window.document.querySelectorAll("body > div > main > div:nth-child(5) > table > tbody > tr > td:nth-child(3) > a");

    const updatedLinksCount = Math.min(links.length, topics.length);
    for (let i = 0; i < updatedLinksCount; i++)
    {
        const topic = topics[i].name;
        const href = links[i].getAttribute("href");
        const link = new URL(href, baseUrl);
        await editTopicForLesson(link, requiredHeaders, topic);
    }
}

/**
 * @param {string | URL | Request} lessonEditLink
 * @param {{ token: any; }} requiredHeaders
 * @param {string} topicName
 */
async function editTopicForLesson(lessonEditLink, requiredHeaders, topicName)
{
    const result = await fetch(lessonEditLink,
    {
        "headers": getHeaders(requiredHeaders),
        "method": "GET",
    });

    if (!result.ok)
    {
        doError(result);
    }

    const htmlText = await result.text();
    const dom = new JSDOM(htmlText);
    const form = dom.window.document.querySelector("form");

    const urlWithParams = new URL(lessonEditLink.toString());

    // The form constructor doesn't work. 
    // Apparently, because in the original API the form has to render once for this to work.
    const formData = new FormData();

    // const formData = urlWithParams.searchParams;
    for (const input of form.querySelectorAll("input"))
    {
        const name = input.getAttribute("name");
        const value = input.getAttribute("value");
        formData.set(name, value);
    }
    for (const select of form.querySelectorAll("select"))
    {
        const name = select.getAttribute("name");
        const options = select.querySelectorAll("option");
        for (const option of options)
        {
            if (option.selected)
            {
                const value = option.getAttribute("value");
                formData.set(name, value);
                break;
            }
        }
    }
    formData.set("LessonTopic", topicName);

    // const dateValue = formData.get("LessonDate");
    // const date = dateValue.toString();
    // const dateObj = moment(date);
    // const newDate = dateObj.local().format('YYYY-MM-DDTHH:mm:ss');

    const result1 = await fetch(urlWithParams,
    {
        "headers": getHeaders(requiredHeaders),
        "method": "POST",
        // Has to be form data here, url encoded doesn't work.
        "body": formData,
    });

    if (!result1.ok)
    {
        doError(result);
    }
}
